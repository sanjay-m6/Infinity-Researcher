"""
Desktop Sidecar Integration Runner.
Listens for commands on stdin from Rust/Tauri and coordinates Scrapy execution and streaming.
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any, Dict
import httpx

from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.engine.crawler import ScrapySearchEngine
from paper_scraper.integration.protocol import PROTOCOL_VERSION, emit_log, emit_response
from paper_scraper.middleware.logging import configure_engine_logging
from paper_scraper.models import QueryFilter
from paper_scraper.pdf import PdfManager
from paper_scraper.ai import chunk_pdf_document, evaluate_hardware_capability, prepare_finetuning_dataset


async def stdin_reader_loop(search_engine: ScrapySearchEngine, pdf_manager: PdfManager) -> None:
    """Async loop reading JSON Lines commands from stdin."""
    emit_log("info", f"Python Scrapy Paper Discovery Engine v{PROTOCOL_VERSION} started")

    running_search_tasks: Dict[str, asyncio.Task] = {}

    while True:
        try:
            line_str = await asyncio.to_thread(sys.stdin.readline)
            if not line_str:
                # EOF reached
                emit_log("info", "stdin EOF reached, shutting down")
                break

            line_str = line_str.strip()
            if not line_str:
                continue

            try:
                msg = json.loads(line_str)
            except json.JSONDecodeError as e:
                emit_log("error", f"Malformed JSON command: {e}")
                continue

            msg_type = msg.get("type")
            request_id = msg.get("request_id", "req_default")

            if msg_type == "handshake":
                client_version = msg.get("client_version", "unknown")
                emit_log("info", f"Handshake received from client {client_version}")
                emit_response("handshake_ack", request_id, {
                    "server_version": PROTOCOL_VERSION,
                    "supported_sources": [d.model_dump() for d in search_engine.registry.list_descriptors()],
                    "status": "ready",
                    "engine_core": "scrapy-2.19.0",
                })

            elif msg_type == "list_sources":
                descriptors = search_engine.registry.list_descriptors()
                emit_response("sources_list", request_id, {
                    "sources": [d.model_dump() for d in descriptors],
                })

            elif msg_type == "start_search":
                job_id = msg.get("job_id") or f"job_{request_id}"
                query = msg.get("query", "").strip()
                sources = msg.get("sources")
                filters_dict = msg.get("filters") or {}

                if not query:
                    emit_response("error", request_id, {
                        "error": "Query cannot be empty",
                    })
                    continue

                q_filter = QueryFilter(
                    query=query,
                    sources=sources,
                    year_start=filters_dict.get("year_start"),
                    year_end=filters_dict.get("year_end"),
                    content_type=filters_dict.get("content_type"),
                    open_access_only=filters_dict.get("open_access_only"),
                    author=filters_dict.get("author"),
                    limit_per_source=filters_dict.get("limit_per_source", 50),
                )

                # Spawn search task in background so stdin loop is never blocked
                task = asyncio.create_task(
                    search_engine.execute_search(
                        job_id=job_id,
                        query=query,
                        sources=sources,
                        filters=q_filter,
                    )
                )
                running_search_tasks[job_id] = task

                def cleanup_task(t: asyncio.Task, jid: str = job_id) -> None:
                    running_search_tasks.pop(jid, None)

                task.add_done_callback(cleanup_task)

                emit_response("search_started_ack", request_id, {
                    "job_id": job_id,
                    "status": "started",
                })

            elif msg_type == "cancel_search":
                job_id = msg.get("job_id")
                if job_id:
                    cancelled = search_engine.cancel_job(job_id)
                    emit_response("cancel_ack", request_id, {
                        "job_id": job_id,
                        "cancelled": cancelled,
                    })

            elif msg_type == "preview_pdf":
                url = msg.get("url", "")
                pdf_res = await pdf_manager.check_pdf_availability(url)
                emit_response("preview_pdf_result", request_id, {
                    "url": url,
                    **pdf_res,
                })

            elif msg_type == "chunk_pdf":
                paper_id = msg.get("paper_id", "paper_unknown")
                pdf_path = msg.get("pdf_path", "")
                try:
                    chunks = chunk_pdf_document(paper_id=paper_id, pdf_path=pdf_path)
                    emit_response("chunk_pdf_result", request_id, {
                        "paper_id": paper_id,
                        "chunk_count": len(chunks),
                        "chunks": chunks,
                    })
                except Exception as ex:
                    emit_response("error", request_id, {"error": str(ex)})

            elif msg_type == "eval_hardware":
                hw_info = evaluate_hardware_capability()
                emit_response("eval_hardware_result", request_id, {
                    "hardware": hw_info,
                })

            elif msg_type == "prepare_finetuning_dataset":
                examples = msg.get("examples", [])
                ratio = float(msg.get("train_ratio", 0.8))
                dataset_res = prepare_finetuning_dataset(examples, train_ratio=ratio)
                emit_response("prepare_finetuning_dataset_result", request_id, {
                    "dataset": dataset_res,
                })

            elif msg_type == "shutdown":
                emit_log("info", "Shutdown command received")
                # Cancel running jobs
                for jid in list(running_search_tasks.keys()):
                    search_engine.cancel_job(jid)
                emit_response("shutdown_ack", request_id, {"status": "shutting_down"})
                break

            else:
                emit_log("warn", f"Unknown command type: {msg_type}")

        except Exception as e:
            emit_log("error", f"Exception in stdin reader: {e}")

    # Wait for remaining tasks
    if running_search_tasks:
        await asyncio.gather(*running_search_tasks.values(), return_exceptions=True)


def run_sidecar() -> None:
    """Main sidecar process entry point."""
    if sys.platform == "win32":
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except AttributeError:
            pass

    configure_engine_logging("WARNING")
    registry = SourceRegistry()
    search_engine = ScrapySearchEngine(registry)
    pdf_manager = PdfManager()

    try:
        asyncio.run(stdin_reader_loop(search_engine, pdf_manager))
    except KeyboardInterrupt:
        emit_log("info", "Engine interrupted by signal")
