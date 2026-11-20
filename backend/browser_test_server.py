"""Start an isolated disposable Django server for frontend Playwright tests."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory


def main():
    import django
    from django.conf import settings
    from django.core.management import call_command

    os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
    with TemporaryDirectory(prefix="elite-browser-") as folder:
        settings.DATABASES["default"]["NAME"] = str(Path(folder) / "browser.sqlite3")
        settings.MEDIA_ROOT = Path(folder) / "media"
        django.setup()
        from users.models import User
        from teams.models import Team

        call_command("migrate", interactive=False, verbosity=0)
        call_command("seed_demo")
        secret = os.environ["ELITE_BROWSER_TEST_PASSWORD"]
        User.objects.create_superuser("test-adviser", password=secret)
        User.objects.create_user(
            "test-staff", password=secret, role="staff", team=Team.objects.first()
        )
        call_command("runserver", "127.0.0.1:8037", use_reloader=False)


if __name__ == "__main__":
    main()
