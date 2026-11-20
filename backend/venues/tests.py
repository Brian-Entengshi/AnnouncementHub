from datetime import time, timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from reservations.models import Reservation
from audit_logs.models import AuditLog
from teams.models import Team
from users.models import User
from .models import Venue


class VenueTests(APITestCase):
    def setUp(self):
        self.adviser = User.objects.create_superuser("adviser")
        self.officer = User.objects.create_user("officer", role="officer")
        self.staff = User.objects.create_user(
            "staff", role="staff", teams=[Team.objects.get(name="Technical Team")]
        )

    def test_default_venues_and_creation_permissions(self):
        expected = {
            "Audio-Visual Room (AVR)",
            "DLL Grounds",
            *(f"ComLab {n}" for n in range(1, 6)),
        }
        response = self.client.get("/api/venues/?bookable=1")
        self.assertEqual(
            {venue["name"] for venue in response.data["results"]}, expected
        )
        payload = {"name": "New facility", "location": "Campus", "capacity": 30}
        for actor in (None, self.officer, self.staff):
            self.client.force_authenticate(actor)
            self.assertEqual(self.client.post("/api/venues/", payload).status_code, 403)
        self.client.force_authenticate(self.adviser)
        result = self.client.post("/api/venues/", payload)
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(
            self.client.post(
                "/api/venues/", {**payload, "name": "NEW FACILITY"}
            ).status_code,
            400,
        )
        self.assertEqual(self.client.get("/api/venues/?bookable=1").data["count"], 8)
        self.client.force_authenticate(self.officer)
        self.assertEqual(
            self.client.patch(
                f"/api/venues/{result.data['id']}/", {"description": "Updated"}
            ).status_code,
            200,
        )

    def test_archive_keeps_booking_details_and_blocks_new_reservations(self):
        legacy = Venue.objects.create(
            name="Innovation Lab",
            location="Campus",
            capacity=20,
        )
        booking = Reservation.objects.create(
            venue=legacy,
            requester=self.staff,
            date=timezone.localdate() + timedelta(days=2),
            start=time(9),
            end=time(10),
            attendees=5,
            title="Original booking",
            description="Original event",
            responsible="Organizer",
            contact="Office",
            status="approved",
        )
        path = f"/api/venues/{legacy.pk}/"
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.assertEqual(self.client.post(path + "archive/").status_code, 403)
        self.client.force_authenticate(self.adviser)
        self.assertEqual(self.client.delete(path).status_code, 409)
        self.assertFalse(
            AuditLog.objects.filter(resource="venue", action="Deleted").exists()
        )
        self.assertEqual(self.client.post(path + "archive/").status_code, 200)
        self.assertEqual(self.client.post(path + "archive/").status_code, 200)
        self.assertEqual(
            AuditLog.objects.filter(resource="venue", action="Archived").count(), 1
        )
        booking.refresh_from_db()
        self.assertEqual(booking.status, "approved")
        self.client.force_authenticate(self.staff)
        self.assertNotIn(
            legacy.pk,
            [row["id"] for row in self.client.get("/api/venues/").data["results"]],
        )
        self.assertEqual(
            self.client.get(f"/api/reservations/{booking.pk}/").data["venue_name"],
            legacy.name,
        )
        self.client.force_authenticate(self.adviser)
        result = self.client.post(
            "/api/reservations/",
            {
                "venue": legacy.pk,
                "date": booking.date.isoformat(),
                "start": "13:00",
                "end": "14:00",
                "attendees": 5,
                "title": "New booking",
                "description": "New event",
                "responsible": "Organizer",
                "contact": "Office",
            },
        )
        self.assertEqual(result.status_code, 400)
        self.assertIn("venue", result.data)
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.get("/api/venues/?archived=1").data["count"], 1)
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.assertTrue(
            Reservation.objects.filter(pk=booking.pk, venue=legacy).exists()
        )

    def test_unreferenced_venue_deletion_writes_one_audit_record(self):
        venue = Venue.objects.create(
            name="Seminar Room",
            location="Campus",
            capacity=60,
            archived=True,
            available=False,
        )
        path = f"/api/venues/{venue.pk}/"
        self.client.force_authenticate(self.adviser)
        self.assertEqual(self.client.delete(path).status_code, 200)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.delete(path).status_code, 404)
        self.assertEqual(
            AuditLog.objects.filter(
                resource="venue", action="Deleted", object_id=venue.pk
            ).count(),
            1,
        )

    def test_inactive_is_separate_and_cannot_take_new_bookings(self):
        venue = Venue.objects.create(
            name="Status test venue", location="Campus", capacity=30
        )
        day = timezone.localdate() + timedelta(days=3)
        existing = Reservation.objects.create(
            venue=venue,
            requester=self.staff,
            date=day,
            start=time(9),
            end=time(10),
            attendees=5,
            title="Existing booking",
            description="Previously approved booking",
            responsible="Member",
            contact="Office",
            status="approved",
        )
        payload = {
            "venue": venue.pk,
            "date": day.isoformat(),
            "start": "13:00",
            "end": "14:00",
            "attendees": 5,
            "title": "Afternoon booking",
            "description": "New request",
            "responsible": "Member",
            "contact": "Office",
        }
        self.client.force_authenticate(self.adviser)
        url = f"/api/venues/{venue.pk}/"

        def ids(path):
            return {item["id"] for item in self.client.get(path).data["results"]}

        self.assertIn(venue.pk, ids("/api/venues/?status=active"))
        self.assertEqual(self.client.patch(url, {"available": False}).status_code, 200)
        self.assertNotIn(venue.pk, ids("/api/venues/?status=active"))
        self.assertIn(venue.pk, ids("/api/venues/?status=inactive"))
        self.assertNotIn(venue.pk, ids("/api/venues/?bookable=1"))
        refused = self.client.post("/api/reservations/", payload)
        self.assertEqual(refused.status_code, 400)
        self.assertIn("venue", refused.data)
        self.assertEqual(self.client.patch(url, {"available": True}).status_code, 200)
        self.assertNotIn(venue.pk, ids("/api/venues/?status=inactive"))
        self.assertIn(venue.pk, ids("/api/venues/?bookable=1"))
        self.assertEqual(
            self.client.post("/api/reservations/", payload).status_code, 201
        )
        existing.refresh_from_db()
        self.assertEqual(existing.status, "approved")
        self.assertEqual(existing.venue, venue)

    def test_retired_venue_cleanup_preserves_history_and_hides_it_from_current_schedules(
        self,
    ):
        from importlib import import_module
        from types import SimpleNamespace
        from django.apps import apps
        from django.db import connection
        from events.models import Event
        from .models import Notice

        names = ("Seminar Room", "Media Studio", "Innovation Lab", "College Auditorium")
        venues = [
            Venue.objects.create(name=name, location="Campus", capacity=25)
            for name in names
        ]
        day = timezone.localdate() + timedelta(days=1)
        booking = Reservation.objects.create(
            venue=venues[1],
            requester=self.staff,
            title="Original booking",
            description="Historical",
            date=day,
            start=time(9),
            end=time(11),
            attendees=10,
            status="approved",
            responsible="Member",
            contact="Office",
        )
        notice = Notice.objects.create(
            venue=venues[1],
            title="Original maintenance notice",
            description="Historical notice",
            starts_at=timezone.now(),
            ends_at=timezone.now() + timedelta(days=2),
        )
        event = Event.objects.create(
            title="Original event", reservation=booking, published=True
        )
        migration = import_module("venues.migrations.0004_remove_retired_venues")
        migration.remove_retired_venues(apps, SimpleNamespace(connection=connection))

        self.assertFalse(Venue.objects.filter(name__in=names).exists())
        booking.refresh_from_db()
        notice.refresh_from_db()
        self.assertIsNone(booking.venue_id)
        self.assertIsNone(notice.venue_id)
        self.assertEqual(booking.status, "approved")
        self.assertEqual(booking.venue_display_name, "Media Studio")
        self.assertEqual(notice.venue_display_name, "Media Studio")

        self.client.force_authenticate(self.adviser)
        self.assertEqual(
            self.client.get(f"/api/reservations/{booking.id}/").data["venue_name"],
            "Media Studio",
        )
        self.assertEqual(
            self.client.get(f"/api/notices/{notice.id}/").data["venue_name"],
            "Media Studio",
        )
        self.assertEqual(self.client.get("/api/notices/?manage=1").data["count"], 0)
        event_response = self.client.get(f"/api/events/{event.id}/").data
        self.assertEqual(event_response["venue_name"], "Media Studio")
        self.assertTrue(event_response["retired_venue"])
        self.assertEqual(self.client.get("/api/dashboard/").data["events"], [])
        self.assertEqual(
            self.client.get("/api/reservations/?for_event=1").data["count"], 0
        )
        result = self.client.post(
            "/api/events/",
            {
                "title": "New event",
                "description": "New schedule",
                "reservation": booking.id,
            },
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(
            self.client.get("/api/availability/").data, {"slots": [], "notices": []}
        )
