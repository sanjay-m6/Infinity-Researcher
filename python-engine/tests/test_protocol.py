import json
import pytest
from paper_scraper.protocol import ProtocolEvent, PROTOCOL_VERSION


def test_protocol_event_serialization():
    event = ProtocolEvent(
        schema_version=PROTOCOL_VERSION,
        job_id="test_job_123",
        type="paper.discovered",
        source_id="arxiv",
        payload={
            "paper": {
                "title": "Test Paper",
                "id": "arxiv_123",
            }
        },
    )

    line = event.to_json_line()
    assert line.endswith("}")

    data = json.loads(line)
    assert data["schema_version"] == "1.0.0"
    assert data["job_id"] == "test_job_123"
    assert data["type"] == "paper.discovered"
    assert data["source_id"] == "arxiv"
    assert data["payload"]["paper"]["title"] == "Test Paper"
