# Phase 15: Library Import & Citation Export Report

## 1. Executive Summary

Scholarly data sovereignty requires that researchers can export their complete library, transfer it to other installations, or interface with reference management tools (Zotero, EndNote, Mendeley, Overleaf). Phase 15 implements a portable, versioned JSON backup format alongside standard BibTeX and RIS export pipelines.

---

## 2. Versioned JSON Backup Specification (`v1.0`)

The JSON backup format encapsulates all library entities, structural relations, and reading progress metadata:

```json
{
  "version": "1.0",
  "app": "Infinity Researcher",
  "exportedAt": "2026-10-30T16:46:19.170Z",
  "counts": {
    "papers": 3,
    "collections": 2
  },
  "collections": [
    {
      "id": "col-1",
      "name": "Foundational Vision",
      "description": "Pivotal computer vision architectures",
      "colorHex": "#6366f1"
    }
  ],
  "papers": [
    {
      "id": "paper-1",
      "title": "Deep Residual Learning for Image Recognition",
      "authors": ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
      "abstract": "Deeper neural networks are more difficult to train.",
      "year": 2015,
      "venue": "CVPR",
      "doi": "10.1109/CVPR.2016.90",
      "landingUrl": "https://arxiv.org/abs/1512.03385",
      "pdfUrl": "https://arxiv.org/pdf/1512.03385.pdf",
      "tags": ["Computer Vision", "Deep Learning"],
      "collectionIds": ["col-1"],
      "readingStatus": "unread",
      "readingProgress": 0,
      "addedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Import Handling:
In `LibraryImportExportModal`, the "Import JSON Backup" tab validates the `papers` array and reconstructs collection memberships and paper metadata without destroying existing library records.

---

## 3. Bibliographic Reference Exports

### 1. BibTeX (`.bib`)
Generates standardized entries suitable for LaTeX / Overleaf:
```bibtex
@article{he2015_1,
  title = {Deep Residual Learning for Image Recognition},
  author = {Kaiming He and Xiangyu Zhang and Shaoqing Ren and Jian Sun},
  year = {2015},
  journal = {CVPR},
  doi = {10.1109/CVPR.2016.90},
  url = {https://arxiv.org/abs/1512.03385},
}
```

### 2. Research Information Systems (`.ris`)
Generates tagged format records for Zotero, Mendeley, and EndNote:
```ris
TY  - JOUR
TI  - Deep Residual Learning for Image Recognition
AU  - Kaiming He
AU  - Xiangyu Zhang
AU  - Shaoqing Ren
AU  - Jian Sun
PY  - 2015
JO  - CVPR
DO  - 10.1109/CVPR.2016.90
UR  - https://arxiv.org/abs/1512.03385
ER  - 
```

Both formats support instantaneous clipboard copying and one-click file download.

