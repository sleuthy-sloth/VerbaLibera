from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[3]
VOICE_ROOT = Path(__file__).parents[1]


def test_voice_runtime_declares_the_supported_python_interpreter() -> None:
    # Break caught: ``python3`` can resolve to macOS Python 3.9, which cannot
    # install the repository's Kokoro 0.9.4 pin.
    assert (VOICE_ROOT / ".python-version").read_text(encoding="utf-8").strip() == "3.11"

    documentation = (REPOSITORY_ROOT / "docs" / "local-voice.md").read_text(
        encoding="utf-8"
    )
    assert "Python 3.10 through 3.12" in documentation
    assert "python3.11 -m venv services/voice/.venv" in documentation


def test_local_pilot_environment_is_not_a_repository_asset() -> None:
    # Break caught: the operator's multi-gigabyte model environment appears as
    # an untracked project change and can be committed with reviewed WAVs.
    ignored_paths = (REPOSITORY_ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "services/voice/.pilot-venv/" in ignored_paths.splitlines()
