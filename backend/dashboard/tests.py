from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from users.models import User


class ContentTests(APITestCase):
    def setUp(self):
        self.editor = User.objects.create_user("adviser", role="adviser")
        self.client.force_authenticate(self.editor)

    def test_announcements_visibility_updates_and_history(self):
        result = self.client.post(
            "/api/announcements/",
            dict(
                title="Assembly",
                description="Meet the team",
                category="General",
                status="draft",
            ),
        )
        self.assertEqual(result.status_code, 201, result.data)
        url = f"/api/announcements/{result.data['id']}/?manage=1"
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.get("/api/audit/").status_code, 403)
        self.client.force_authenticate(self.editor)
        self.assertEqual(
            self.client.patch(url, {"status": "published"}).status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/dashboard/").data["counts"]["announcements"], 1
        )
        self.assertEqual(
            self.client.patch(
                url, {"expires": str(timezone.localdate() - timedelta(days=1))}
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/api/dashboard/").data["counts"]["announcements"], 0
        )
        self.assertEqual(self.client.delete(url).status_code, 204)

    def test_activity_venue_notice_and_link_crud(self):
        today = timezone.localdate()
        venue = self.client.post(
            "/api/venues/", dict(name="Hall", location="Main", capacity=5)
        )
        self.assertEqual(venue.status_code, 201, venue.data)
        activity = self.client.post(
            "/api/activities/",
            dict(
                title="Pilot",
                description="Club project",
                start_date=today,
                end_date=today,
                published=True,
            ),
        )
        self.assertEqual(activity.status_code, 201, activity.data)
        self.assertEqual(activity.data["status"], "ongoing")
        self.assertEqual(
            self.client.patch(
                f"/api/activities/{activity.data['id']}/",
                {"end_date": str(today - timedelta(days=1))},
            ).status_code,
            400,
        )
        now = timezone.now()
        notice = self.client.post(
            "/api/notices/",
            dict(
                title="Inspection",
                description="Studio",
                venue=venue.data["id"],
                starts_at=now - timedelta(days=3),
                ends_at=now - timedelta(days=1),
            ),
        )
        self.assertEqual(notice.status_code, 201, notice.data)
        self.assertEqual(self.client.get("/api/notices/").data["count"], 0)
        link = self.client.post(
            "/api/links/",
            dict(title="Research", category="Learning", url="https://example.org"),
        )
        self.assertEqual(link.status_code, 201, link.data)
        self.assertEqual(
            self.client.patch(
                f"/api/links/{link.data['id']}/", {"url": "javascript:void(0)"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.delete(f"/api/links/{link.data['id']}/").status_code, 204
        )
