#!/usr/bin/env python3
"""Tiny local inference server placeholder for NizamKitchen.

Run with:
  python scripts/ai/local-inference-server-placeholder.py

Then configure:
  AI_PROVIDER=local_http
  LOCAL_AI_ENABLED=true
  LOCAL_AI_BASE_URL=http://localhost:8001

This is not a real model. It returns a schema-valid sample response so the app
can test local_http plumbing before a fine-tuned model exists.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/analyze-cooking-video":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("content-length", 0))
        body = self.rfile.read(length)
        payload = json.loads(body or b"{}")
        recipe_name = payload.get("recipeName", "recipe")

        response = {
            "title": f"Local placeholder analysis for {recipe_name}",
            "summary": "Placeholder local server response. Replace with a real local model before production use.",
            "confidence": "low",
            "ingredients": [],
            "steps": [
                {
                    "stepNumber": 1,
                    "description": "Placeholder step from local inference server.",
                    "confidence": "low",
                }
            ],
            "differencesFromWrittenRecipe": [],
            "warnings": ["Placeholder response; not real model output."],
        }

        encoded = json.dumps(response).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main():
    server = HTTPServer(("localhost", 8001), Handler)
    print("NizamKitchen local placeholder server listening on http://localhost:8001")
    server.serve_forever()


if __name__ == "__main__":
    main()
