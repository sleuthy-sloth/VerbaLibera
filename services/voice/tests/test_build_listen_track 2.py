"""Authoring contract: one ordered script drives audio and the read-along."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "build_listen_track", Path(__file__).parents[1] / "scripts/build_listen_track.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ListenScriptTests(unittest.TestCase):
    def script(self):
        return {"lessonId": "es-introductions-foundation", "courseSlug": "spanish",
                "lessonTitle": "Introductions", "language": "es", "voice": "ef_dora",
                "sections": [{"heading": "Your turn", "teacher": "Say hello.",
                              "thinkSeconds": 8,
                              "target": {"text": "Hola.", "meaning": "Hello."}}]}

    def test_prediction_pause_precedes_reveal(self):
        events = module.plan(self.script())
        self.assertEqual([e["kind"] for e in events], ["speech", "silence", "speech", "silence"])
        self.assertEqual(events[1]["seconds"], 8)
        self.assertEqual(events[0]["language"], "en")
        self.assertEqual(events[2]["language"], "es")
        self.assertEqual(events[2]["text"], "Hola.")

    def test_no_silent_placeholder_or_wrong_language_voice(self):
        for field, value in [("voice", "if_sara"), ("lessonId", "../escape")]:
            script = self.script()
            script[field] = value
            with self.assertRaises(ValueError):
                module.plan(script)
        script = self.script()
        script["sections"][0]["teacher"] = ""
        with self.assertRaises(ValueError):
            module.plan(script)

    def test_pause_requires_a_reveal_and_is_bounded(self):
        script = self.script()
        script["sections"][0]["thinkSeconds"] = 100
        with self.assertRaises(ValueError):
            module.plan(script)
        script = self.script()
        del script["sections"][0]["target"]
        with self.assertRaises(ValueError):
            module.plan(script)


if __name__ == "__main__":
    unittest.main()
