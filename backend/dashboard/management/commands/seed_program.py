from datetime import time, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from activities.models import Activity
from audit_logs.models import AuditLog
from dashboard.models import DemoProgramEntry
from events.models import Event
from users.models import User
from venues.models import Venue


# Offsets are relative to tomorrow, in Asia/Manila.
PROGRAM = (
    (
        "orientation",
        "DLL Elite member orientation",
        "Campus organization briefing",
        "The officers introduce new students to campus committees and walk through event sign-up.",
        "Audio-Visual Room (AVR)",
        0,
        time(9),
        time(10, 30),
    ),
    (
        "campus-care",
        "Campus care and clean-up drive",
        "Clean-up kickoff and team briefing",
        "The Technical Team sets collection points and distributes equipment. Volunteers work in zones and record the materials collected.",
        "DLL Grounds",
        1,
        time(8),
        time(10),
    ),
    (
        "leadership",
        "Peer leadership and facilitation",
        "Small-group facilitation lab",
        "Organization officers lead short exercises on meeting facilitation, delegation, and resolving disagreements in project teams.",
        "ComLab 1",
        3,
        time(9),
        time(11),
    ),
    (
        "editorial",
        "Student publication workshop",
        "Caption and layout clinic",
        "The Editing Team prepares a campus feature and reviews captions, readable typography, and accessible layouts in pairs.",
        "ComLab 2",
        3,
        time(13, 30),
        time(15),
    ),
    (
        "documentation",
        "Campus documentation skills series",
        "Photo documentation workflow",
        "The Documentation Team practices documenting campus events, organizing consent forms, and preparing a shareable photo archive.",
        "ComLab 3",
        5,
        time(10),
        time(12),
    ),
    (
        "production",
        "Multimedia production practicum",
        "Storyboarding and video editing lab",
        "The Videographer Team develops a short campus story and edits footage into a one-minute recap with captions.",
        "ComLab 4",
        8,
        time(14),
        time(16),
    ),
    (
        "planning",
        "Student engagement project planning",
        "Committee project planning session",
        "The officers and team leads agree on milestones, assign owners, and draft the resource requests for the next student engagement project.",
        "ComLab 5",
        10,
        time(10, 30),
        time(12),
    ),
)


class Command(BaseCommand):
    help = "Add the DLL Elite demonstration program once, with public event schedules."

    def add_arguments(self, parser):
        parser.add_argument(
            "--adviser", required=True, help="Existing active adviser username"
        )

    def handle(self, *args, **options):
        adviser = User.objects.filter(
            username=options["adviser"], role="adviser", is_active=True
        ).first()
        if adviser is None:
            raise CommandError(
                "Choose an existing active adviser for the demonstration program."
            )
        tomorrow = timezone.localdate() + timedelta(days=1)
        added = sum(self.add_entry(adviser, tomorrow, entry) for entry in PROGRAM)
        self.stdout.write(
            f"Added {added} demonstration activities and {added} scheduled events."
        )

    @transaction.atomic
    def add_entry(self, adviser, tomorrow, entry):
        (
            key,
            title,
            event_title,
            description,
            venue_name,
            offset,
            start,
            end,
        ) = entry
        if DemoProgramEntry.objects.filter(key=key).exists():
            return False
        if (
            Activity.objects.filter(title=title).exists()
            or Event.objects.filter(title=event_title).exists()
        ):
            self.stderr.write(f"Skipped {title}: a record already uses this title.")
            return False
        venue = Venue.objects.filter(
            name=venue_name, available=True, archived=False
        ).first()
        if not venue:
            self.stderr.write(f"Skipped {title}: {venue_name} is unavailable.")
            return False
        date = tomorrow + timedelta(days=offset)
        activity = Activity.objects.create(
            title=title,
            description=description,
            start_date=date,
            end_date=date + timedelta(days=3),
            published=True,
        )
        AuditLog.record(
            adviser,
            "Created",
            activity,
            description="Installed a demonstration activity.",
        )
        event = Event.objects.create(
            title=event_title,
            description=description,
            venue=venue,
            date=date,
            start=start,
            end=end,
            author=adviser,
            activity=activity,
            published=True,
        )
        AuditLog.record(
            adviser,
            "Created",
            event,
            description="Published a demonstration event.",
        )
        DemoProgramEntry.objects.create(key=key)
        return True
