from datetime import datetime, time, timedelta

from django.db import connection
from django.utils import timezone
from rest_framework.test import APITestCase

from audit_logs.models import AuditLog
from events.models import Event
from teams.models import Team
from users.models import User
from .models import Notice, Venue


class VenueTests(APITestCase):
    def setUp(self):
        self.adviser = User.objects.create_superuser("venue-adviser")
        self.officer = User.objects.create_user("venue-officer", role="officer")
        self.staff = User.objects.create_user(
            "venue-staff", role="staff", teams=[Team.objects.first()]
        )
        self.venue = Venue.objects.get(name="ComLab 1")
        self.day = timezone.localdate() + timedelta(days=7)
        self.start = timezone.make_aware(datetime.combine(self.day, time(9)))

    def test_venue_management_is_adviser_only(self):
        expected = {
            "Audio-Visual Room (AVR)",
            "DLL Grounds",
            *(f"ComLab {i}" for i in range(1, 6)),
        }
        body = {"name": "Hall", "location": "Campus", "capacity": 20}
        existing = f"/api/venues/{self.venue.pk}/"
        for user in (None, self.officer, self.staff):
            self.client.force_authenticate(user)
            self.assertEqual(
                self.client.get("/api/venues/?status=inactive").status_code, 403
            )
            self.assertEqual(self.client.get(existing).status_code, 403)
            self.assertEqual(self.client.post("/api/venues/", body).status_code, 403)
            self.assertEqual(self.client.put(existing, body).status_code, 403)
            self.assertEqual(
                self.client.patch(existing, {"available": False}).status_code, 403
            )
            self.assertEqual(self.client.delete(existing).status_code, 403)
            self.assertEqual(self.client.post(existing + "archive/").status_code, 403)

        self.assertFalse(AuditLog.objects.filter(resource="venue").exists())
        self.client.force_authenticate(self.adviser)
        self.assertEqual(
            {item["name"] for item in self.client.get("/api/venues/").data["results"]},
            expected,
        )
        result = self.client.post("/api/venues/", body)
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(
            self.client.post("/api/venues/", {**body, "name": "HALL"}).status_code, 400
        )
        path = f"/api/venues/{result.data['id']}/"
        self.assertEqual(self.client.patch(path, {"available": False}).status_code, 200)
        self.assertEqual(
            self.client.get("/api/venues/?status=inactive").data["count"], 1
        )
        self.assertEqual(self.client.delete(path).status_code, 200)
        self.assertEqual(self.client.delete(path).status_code, 404)

    def test_authenticated_options_only_expose_active_venue_names(self):
        Venue.objects.create(
            name="Unavailable", location="Campus", capacity=20, available=False
        )
        Venue.objects.create(
            name="Archived", location="Campus", capacity=20, archived=True
        )
        url = "/api/venue-options/?status=archived&manage=1"
        self.assertEqual(self.client.get(url).status_code, 403)
        for user in (self.adviser, self.officer, self.staff):
            self.client.force_authenticate(user)
            result = self.client.get(url)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data["count"], 7)
            for venue in result.data["results"]:
                self.assertEqual(set(venue), {"id", "name"})
                self.assertNotIn(venue["name"], {"Unavailable", "Archived"})
            self.assertEqual(
                self.client.post(url, {"name": "Unauthorized"}).status_code, 405
            )
            self.assertEqual(self.client.get("/api/availability/").status_code, 200)

    def test_archiving_protects_linked_events_and_preserves_schedule(self):
        event = Event.objects.create(
            title="Lab session",
            description="Lab practice",
            venue=self.venue,
            date=self.day,
            start=time(9),
            end=time(11),
            published=True,
        )
        path = f"/api/venues/{self.venue.pk}/"
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
        self.assertEqual(
            self.client.get("/api/venues/?status=archived").data["count"], 1
        )
        self.assertEqual(self.client.patch(path, {"available": True}).status_code, 400)
        self.assertEqual(
            self.client.get(
                "/api/availability/", {"from": self.day, "to": self.day}
            ).data["events"],
            [],
        )
        self.client.force_authenticate(None)
        item = self.client.get(f"/api/events/{event.pk}/").data
        self.assertEqual(item["venue_name"], self.venue.name)
        self.assertEqual(item["date"], str(self.day))

    def test_notices_publish_unpublish_archive_and_feed_availability(self):
        self.client.force_authenticate(self.officer)
        notice = self.client.post(
            "/api/notices/",
            {
                "title": "Lab inspection",
                "description": "Scheduled inspection",
                "venue": self.venue.pk,
                "starts_at": self.start,
                "ends_at": self.start + timedelta(hours=2),
            },
        )
        self.assertEqual(notice.status_code, 201, notice.data)
        path = f"/api/notices/{notice.data['id']}/"
        self.assertEqual(notice.data["publication_status"], "draft")
        responded = self.client.patch(
            path + "?manage=1", {"publication_status": "published"}
        )
        self.assertEqual(responded.status_code, 200, responded.data)
        self.assertIsNotNone(responded.data["published_at"])
        self.assertEqual(Notice.objects.get(pk=notice.data["id"]).author, self.officer)
        Event.objects.create(
            title="Workshop",
            description="Lab activity",
            venue=self.venue,
            date=self.day,
            start=time(12),
            end=time(13),
            published=True,
        )
        Event.objects.create(
            title="Draft event",
            description="Internal",
            venue=self.venue,
            date=self.day,
            start=time(13),
            end=time(14),
        )
        params = {"from": self.day, "to": self.day, "venue": self.venue.pk}
        response = self.client.get("/api/availability/", params).data
        self.assertEqual([item["title"] for item in response["events"]], ["Workshop"])
        self.assertEqual(response["notices"][0]["venue_name"], self.venue.name)
        self.assertEqual(
            self.client.get("/api/availability/", {**params, "status": "events"}).data[
                "notices"
            ],
            [],
        )
        self.assertEqual(
            self.client.get("/api/availability/", {**params, "status": "notices"}).data[
                "events"
            ],
            [],
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/availability/").status_code, 403)
        public = self.client.get(path).data
        self.assertEqual(public["author_name"], "Organization Officer")
        self.assertNotIn("author", public)
        self.assertNotIn("publication_status", public)
        self.assertEqual(self.client.delete(path).status_code, 403)
        for status in ("draft", "archived"):
            self.client.force_authenticate(self.officer)
            self.assertEqual(
                self.client.patch(
                    path + "?manage=1", {"publication_status": status}
                ).status_code,
                200,
            )
            self.assertEqual(
                self.client.get("/api/availability/", params).data["notices"], []
            )
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(path + "?manage=1").status_code, 404)
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.delete(path + "?manage=1").status_code, 204)

    def test_retired_reservation_tables_and_endpoint_are_absent(self):
        self.client.force_authenticate(self.adviser)
        self.assertEqual(self.client.get("/api/reservations/").status_code, 404)
        self.assertFalse(
            any(
                name.startswith("reservations_")
                for name in connection.introspection.table_names()
            )
        )
