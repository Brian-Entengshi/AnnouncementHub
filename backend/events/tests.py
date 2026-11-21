from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from announcements.models import Announcement
from users.models import User
from venues.models import Venue
from .models import Event


class EventPublicationTests(APITestCase):
    def test_event_schedule_publication_and_author_privacy(self):
        editor = User.objects.create_user(
            "private-publisher", role="officer", email="private@example.test"
        )
        venue = Venue.objects.get(name="DLL Grounds")
        date = timezone.localdate() + timedelta(days=4)
        self.client.force_authenticate(editor)
        body = {
            "title": "Campus open day",
            "description": "Learn about student groups",
            "venue": venue.pk,
            "date": date,
            "start": "09:00",
            "end": "12:00",
        }
        self.assertEqual(
            self.client.post("/api/events/", {**body, "end": "08:00"}).status_code, 400
        )
        created = self.client.post("/api/events/", body)
        self.assertEqual(created.status_code, 201, created.data)
        path = f"/api/events/{created.data['id']}/"
        self.assertEqual(Event.objects.get(pk=created.data["id"]).author, editor)
        self.assertEqual(self.client.get(path + "?manage=1&public=1").status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(path + "?manage=1").status_code, 404)
        self.assertEqual(self.client.post("/api/events/", body).status_code, 403)
        self.client.force_authenticate(editor)
        self.assertEqual(
            self.client.patch(path + "?manage=1", {"published": True}).status_code, 200
        )
        self.client.force_authenticate(None)
        item = self.client.get(path).data
        self.assertEqual(
            set(item),
            {
                "id",
                "title",
                "description",
                "date",
                "start",
                "end",
                "venue",
                "venue_name",
                "author_name",
                "image",
                "status",
            },
        )
        self.assertEqual(item["author_name"], "Organization Officer")
        self.assertEqual(item["venue_name"], "DLL Grounds")
        self.assertEqual(item["date"], str(date))
        self.assertEqual(self.client.get("/api/events/?upcoming=1").data["count"], 1)
        Event.objects.filter(pk=created.data["id"]).update(cancelled=True)
        self.assertEqual(self.client.get(path).data["status"], "cancelled")
        self.assertEqual(self.client.get("/api/events/?upcoming=1").data["count"], 0)

    def test_public_announcement_fields_and_member_endpoints(self):
        author = User.objects.create_superuser("private-adviser")
        announcement = Announcement.objects.create(
            title="Public post",
            description="Welcome",
            category="Club",
            author=author,
            status="published",
        )
        result = self.client.get(f"/api/announcements/{announcement.pk}/?manage=1")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["author_name"], "Organization Adviser")
        self.assertNotIn("author", result.data)
        for endpoint in (
            "dashboard",
            "activities",
            "teams",
            "venues",
            "availability",
            "accounts",
            "audit",
        ):
            self.assertEqual(
                self.client.get(f"/api/{endpoint}/?manage=1").status_code, 403, endpoint
            )
