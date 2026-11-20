"""Start an isolated disposable Django server for frontend Playwright tests."""

import os
from datetime import time, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory


def main():
    import django
    from django.conf import settings
    from django.core.management import call_command
    from django.utils import timezone

    copied_database = os.environ.get("ELITE_BROWSER_TEST_DB_COPY")
    os.environ["DJANGO_SETTINGS_MODULE"] = (
        "config.settings" if copied_database else "config.test_settings"
    )
    with TemporaryDirectory(prefix="elite-browser-") as folder:
        if copied_database:
            copy = Path(copied_database).resolve()
            if (
                copy == settings.DATABASES["default"]["NAME"].resolve()
                or not copy.is_file()
            ):
                raise RuntimeError(
                    "Use an existing disposable database copy for browser testing."
                )
            settings.DATABASES["default"]["NAME"] = str(copy)
            settings.MEDIA_ROOT = Path(folder) / "media"
            django.setup()
            call_command("runserver", "127.0.0.1:8037", use_reloader=False)
            return
        settings.DATABASES["default"]["NAME"] = str(Path(folder) / "browser.sqlite3")
        settings.MEDIA_ROOT = Path(folder) / "media"
        django.setup()
        from users.models import User
        from teams.models import Team
        from audit_logs.models import AuditLog
        from events.models import Event
        from reservations.models import Reservation
        from useful_links.models import UsefulLink
        from venues.models import Venue

        call_command("migrate", interactive=False, verbosity=0)
        call_command("seed_demo")
        call_command("seed_venue_notices")
        UsefulLink.objects.create(
            title="Campus library guide",
            description="Opening hours",
            category="Campus",
            url="https://example.org/",
        )
        secret = os.environ["ELITE_BROWSER_TEST_PASSWORD"]
        adviser = User.objects.create_superuser("test-adviser", password=secret)
        User.objects.create_user("test-officer", password=secret, role="officer")
        User.objects.create_user(
            "test-staff", password=secret, role="staff", teams=[Team.objects.first()]
        )
        team = Team.objects.get(name="Technical Team")
        for index in range(21):
            User.objects.create_user(
                username=f"directory-{index:02}",
                first_name=f"Directory member {index:02}",
                role="staff",
                teams=[team],
            )
        for _ in range(21):
            AuditLog.authentication(adviser, "LOGIN")

        today = timezone.localdate()
        future_monday = today + timedelta(days=21 - today.weekday())
        venue = Venue.objects.get(name="ComLab 3")
        for title, offset, hour, status in [
            ("Calendar workshop", 0, 9, "approved"),
            ("Calendar orientation", 0, 11, "approved"),
            ("Calendar cancelled session", 1, 9, "cancelled"),
        ]:
            reservation = Reservation.objects.create(
                venue=venue,
                requester=adviser,
                date=future_monday + timedelta(days=offset),
                start=time(hour),
                end=time(hour + 1),
                attendees=10,
                title=title,
                description="Calendar test event",
                responsible="Organizer",
                contact="Campus office",
                status=status,
            )
            Event.objects.create(
                title=title,
                description=reservation.description,
                reservation=reservation,
                published=True,
            )

        call_command("runserver", "127.0.0.1:8037", use_reloader=False)


if __name__ == "__main__":
    main()
