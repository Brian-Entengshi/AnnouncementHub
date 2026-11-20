from datetime import time, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from dashboard.models import DemoProgramEntry
from reservations.services import local_instant
from venues.models import Notice, Venue
from venues.serializers import NoticeSerializer


# Key, venue, title, description, start offset (days), duration (hours), blocks bookings.
NOTICES = (
    (
        "avr-guidelines",
        "Audio-Visual Room (AVR)",
        "AVR equipment checkout guidelines",
        "Request wireless microphones from the venue desk before your session. List the equipment on your booking and return it to the cabinet after use.",
        -1,
        120,
        False,
    ),
    (
        "grounds-preparation",
        "DLL Grounds",
        "Keep the east walkway clear",
        "Campus crews are marking event setup zones beside the east walkway. Keep the marked pedestrian route clear of tables, signs, and event supplies. Regular bookings can continue.",
        -1,
        96,
        False,
    ),
    (
        "lab3-inspection",
        "ComLab 3",
        "Report loose cables before using ComLab 3",
        "For the current inspection period, report loose network or power cables at the lab desk. Staff will tag affected workstations. Bookings can proceed with the remaining workstations.",
        -1,
        72,
        False,
    ),
    (
        "avr-maintenance",
        "Audio-Visual Room (AVR)",
        "AVR projector and audio servicing",
        "Technicians will clean the projector filters, check the HDMI inputs, and calibrate the room speakers. Booking requests that overlap the service window are blocked.",
        2,
        2,
        True,
    ),
    (
        "grounds-restriction",
        "DLL Grounds",
        "DLL Grounds drainage inspection",
        "Facilities staff will inspect drainage covers and mark any areas that need repair. The grounds are closed to new bookings during the inspection.",
        3,
        2,
        True,
    ),
    (
        "lab1-update",
        "ComLab 1",
        "ComLab 1 image and software update",
        "The lab team will install security updates and refresh the workstation image. Save work to your organization drive before the maintenance window.",
        4,
        2,
        True,
    ),
    (
        "lab2-closure",
        "ComLab 2",
        "ComLab 2 power outlet testing",
        "Facilities staff will test the desk outlets and label the circuits. The lab cannot accept reservations during this work.",
        5,
        2,
        True,
    ),
    (
        "lab4-inspection",
        "ComLab 4",
        "ComLab 4 workstation inventory",
        "The technical team will verify equipment tags and test loaned peripherals. Leave all monitors and adapters at their assigned stations until the inventory is complete.",
        6,
        2,
        True,
    ),
    (
        "lab5-network",
        "ComLab 5",
        "ComLab 5 network maintenance",
        "The campus IT team will replace a network switch and test access to the learning portal. The lab is closed to bookings during the work.",
        7,
        2,
        True,
    ),
    (
        "lab3-safety-history",
        "ComLab 3",
        "ComLab 3 workstation cleaning completed",
        "The cleaning period has ended. Keyboards and work surfaces were cleaned, and the lab returned to its normal reservation schedule.",
        -7,
        4,
        False,
    ),
)


class Command(BaseCommand):
    help = "Install demonstration venue notices without changing existing notices or booked slots."

    def handle(self, *args, **options):
        today = timezone.localdate()
        added = sum(self.add_notice(today, notice) for notice in NOTICES)
        self.stdout.write(f"Added {added} demonstration venue notices.")

    @transaction.atomic
    def add_notice(self, today, notice):
        key, venue_name, title, description, offset, hours, blocks = notice
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
        first_date = today + timedelta(days=offset)
        candidate_days = (0, 1, 2, 3, 7) if blocks else (0,)
        for shift in candidate_days:
            start = local_instant(first_date + timedelta(days=shift), time(8))
            serializer = NoticeSerializer(
                data={
                    "venue": venue.pk,
                    "title": title,
                    "description": description,
                    "starts_at": start,
                    "ends_at": start + timedelta(hours=hours),
                    "blocks_bookings": blocks,
                }
            )
            if serializer.is_valid():
                serializer.save()
                DemoProgramEntry.objects.create(key=marker)
                return True
        self.stdout.write(f"Skipped {title}: no conflict-free notice window found.")
        return False
