from datetime import datetime, time, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from dashboard.models import DemoProgramEntry
from venues.models import Notice, Venue


# Key, venue, title, description, start offset (days), duration (hours).
NOTICES = (
    (
        "avr-guidelines",
        "Audio-Visual Room (AVR)",
        "AVR equipment checkout guidelines",
        "Request wireless microphones from the venue desk before your session. Coordinate equipment with the venue desk and return it to the cabinet after use.",
        -1,
        120,
    ),
    (
        "grounds-preparation",
        "DLL Grounds",
        "Keep the east walkway clear",
        "Campus crews are marking event setup zones beside the east walkway. Keep the marked pedestrian route clear of tables, signs, and event supplies.",
        -1,
        96,
    ),
    (
        "lab3-inspection",
        "ComLab 3",
        "Report loose cables before using ComLab 3",
        "For the current inspection period, report loose network or power cables at the lab desk. Staff will tag affected workstations. Remaining workstations can still be used.",
        -1,
        72,
    ),
    (
        "avr-maintenance",
        "Audio-Visual Room (AVR)",
        "AVR projector and audio servicing",
        "Technicians will clean the projector filters, check the HDMI inputs, and calibrate the room speakers. The room is closed during the service window.",
        2,
        2,
    ),
    (
        "grounds-restriction",
        "DLL Grounds",
        "DLL Grounds drainage inspection",
        "Facilities staff will inspect drainage covers and mark any areas that need repair. The grounds are closed to visitors during the inspection.",
        3,
        2,
    ),
    (
        "lab1-update",
        "ComLab 1",
        "ComLab 1 image and software update",
        "The lab team will install security updates and refresh the workstation image. Save work to your organization drive before the maintenance window.",
        4,
        2,
    ),
    (
        "lab2-closure",
        "ComLab 2",
        "ComLab 2 power outlet testing",
        "Facilities staff will test the desk outlets and label the circuits. The lab is closed to visitors during this work.",
        5,
        2,
    ),
    (
        "lab4-inspection",
        "ComLab 4",
        "ComLab 4 workstation inventory",
        "The technical team will verify equipment tags and test loaned peripherals. Leave all monitors and adapters at their assigned stations until the inventory is complete.",
        6,
        2,
    ),
    (
        "lab5-network",
        "ComLab 5",
        "ComLab 5 network maintenance",
        "The campus IT team will replace a network switch and test access to the learning portal. The lab is closed to visitors during the work.",
        7,
        2,
    ),
    (
        "lab3-safety-history",
        "ComLab 3",
        "ComLab 3 workstation cleaning completed",
        "The cleaning period has ended. Keyboards and work surfaces were cleaned, and the lab returned to its normal hours.",
        -7,
        4,
    ),
)


class Command(BaseCommand):
    help = "Install demonstration venue notices without changing existing notices."

    def handle(self, *args, **options):
        today = timezone.localdate()
        added = sum(self.add_notice(today, notice) for notice in NOTICES)
        self.stdout.write(f"Added {added} demonstration venue notices.")

    @transaction.atomic
    def add_notice(self, today, notice):
        key, venue_name, title, description, offset, hours = notice
        marker = "notice-" + key
        if DemoProgramEntry.objects.filter(key=marker).exists():
            return False
        venue = Venue.objects.filter(
            name=venue_name, available=True, archived=False
        ).first()
        if not venue or Notice.objects.filter(venue=venue, title=title).exists():
            self.stdout.write(
                f"Skipped {title}: venue unavailable or title already in use."
            )
            return False
        start = timezone.make_aware(
            datetime.combine(today + timedelta(days=offset), time(8))
        )
        Notice.objects.create(
            venue=venue,
            title=title,
            description=description,
            starts_at=start,
            ends_at=start + timedelta(hours=hours),
            publication_status="published",
            published_at=timezone.now(),
        )
        DemoProgramEntry.objects.create(key=marker)
        return True
