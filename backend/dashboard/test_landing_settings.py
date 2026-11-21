from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from announcements.models import Announcement
from audit_logs.models import AuditLog
from teams.models import Team
from users.models import User

from .models import HubSettings


class LandingSettingsTests(APITestCase):
    def setUp(self):
        self.adviser = User.objects.create_superuser("landing-adviser")
        self.public = APIClient()
        self.client.force_authenticate(self.adviser)

    def test_editing_publishes_persisted_content_and_keeps_unrelated_fields(self):
        HubSettings.objects.create(
            pk=1, contact_email="club@example.test", office_hours="By appointment"
        )
        changes = {
            "hero_heading": "Explore the DLL Elite program",
            "hero_cta_label": "Meet DLL Elite",
            "hero_cta_section": "about",
            "about_mission": "Support student-led projects.",
            "contact_phone": "+63 (2) 8123-4567",
            "office_location": "Student organization office",
            "facebook_url": "https://www.facebook.com/dll-elite",
        }
        result = self.client.patch("/api/settings/", changes, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        published = self.public.get("/api/organization/")
        self.assertEqual(published.status_code, 200)
        self.assertIn("no-store", published["Cache-Control"])
        self.assertEqual(published.data["contact_email"], "club@example.test")
        self.assertEqual(published.data["office_hours"], "By appointment")
        self.assertEqual(published.data["about_vision"], "")
        self.assertEqual(published.data, result.data)
        self.assertNotIn("remove_hero_image", published.data)
        stored = HubSettings.objects.get(pk=1)
        for key, value in changes.items():
            self.assertEqual(getattr(stored, key), value)
            self.assertEqual(published.data[key], value)

        entry = AuditLog.objects.get(resource="settings", action="Published")
        self.assertEqual(entry.actor_id, self.adviser.pk)
        self.assertIn("Home copy, About, Contacts", entry.description)
        self.assertNotIn(changes["hero_heading"], entry.description)
        self.assertNotIn(changes["contact_phone"], entry.description)
        self.assertEqual(
            self.client.patch("/api/settings/", changes, format="json").status_code, 200
        )
        self.assertEqual(AuditLog.objects.filter(resource="settings").count(), 1)

    def test_public_reads_and_only_adviser_writes(self):
        staff = User.objects.create_user(
            "landing-staff", role="staff", teams=[Team.objects.first()]
        )
        officer = User.objects.create_user("landing-officer", role="officer")
        for account in (None, officer, staff):
            self.client.force_authenticate(account)
            self.assertEqual(self.client.get("/api/settings/").status_code, 403)
            self.assertEqual(
                self.client.patch(
                    "/api/settings/", {"hero_heading": "Injected"}
                ).status_code,
                403,
            )
            self.assertEqual(self.client.get("/api/organization/").status_code, 200)
            self.assertEqual(
                self.client.patch(
                    "/api/organization/", {"hero_heading": "Injected"}
                ).status_code,
                405,
            )
        public = self.public.get("/api/organization/").data
        self.assertEqual(public["hero_heading"], "Club events and campus announcements")
        self.assertIsNone(public["hero_image"])
        self.assertFalse(HubSettings.objects.exists())

    def test_invalid_content_cannot_partially_publish(self):
        response = self.client.patch(
            "/api/settings/",
            {
                "hero_heading": "Valid heading",
                "hero_cta_section": "https://example.test/",
                "contact_email": "inbox",
                "contact_phone": "+63 Call 1234567",
                "facebook_url": "ftp://www.facebook.com/dll-elite",
                "announcement_page_size": 13,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        for field in (
            "hero_cta_section",
            "contact_email",
            "contact_phone",
            "announcement_page_size",
        ):
            self.assertIn(field, response.data)
        self.assertEqual(
            self.client.patch(
                "/api/settings/",
                {"website_url": "https://name:password@example.test/"},
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(
                "/api/settings/",
                {"website_url": "ftp://example.test/page"},
                format="json",
            ).status_code,
            400,
        )
        self.assertFalse(HubSettings.objects.exists())
        self.assertFalse(AuditLog.objects.filter(resource="settings").exists())

    def test_hero_image_publish_replace_clear_and_validation(self):
        def upload(image_format="PNG"):
            content = BytesIO()
            Image.new("RGB", (8, 8)).save(content, format=image_format)
            return SimpleUploadedFile(
                "hero." + image_format.lower(),
                content.getvalue(),
                content_type="image/" + image_format.lower(),
            )

        with TemporaryDirectory(prefix="elite-landing-test-") as media:
            with override_settings(MEDIA_ROOT=media):
                first = self.client.patch(
                    "/api/settings/",
                    {"hero_image": upload(), "hero_image_alt": "Campus facade"},
                    format="multipart",
                )
                self.assertEqual(first.status_code, 200, first.data)
                old_url = first.data["hero_image"]
                public_file = self.public.get(old_url)
                self.assertEqual(public_file.status_code, 200)
                self.assertEqual(public_file["Content-Type"], "image/png")
                self.assertTrue(
                    b"".join(public_file.streaming_content).startswith(b"\x89PNG")
                )
                published = self.public.get("/api/organization/").data
                self.assertEqual(published["hero_image_alt"], "Campus facade")
                self.assertEqual(published["hero_image"], old_url)

                invalid = self.client.patch(
                    "/api/settings/", {"hero_image": upload("GIF")}, format="multipart"
                )
                self.assertEqual(invalid.status_code, 400)
                second = self.client.patch(
                    "/api/settings/", {"hero_image": upload()}, format="multipart"
                )
                self.assertEqual(second.status_code, 200, second.data)
                new_url = second.data["hero_image"]
                self.assertNotEqual(old_url, new_url)
                self.assertEqual(self.public.get(old_url).status_code, 404)

                removed = self.client.patch(
                    "/api/settings/", {"hero_image": None}, format="json"
                )
                self.assertEqual(removed.status_code, 200)
                self.assertIsNone(
                    self.public.get("/api/organization/").data["hero_image"]
                )
                self.assertEqual(self.public.get(new_url).status_code, 404)
                self.assertIn(
                    "Home image",
                    AuditLog.objects.filter(resource="settings").first().description,
                )

    def test_public_announcement_count_and_pinned_order_use_saved_settings(self):
        now = timezone.now()
        Announcement.objects.create(
            author=self.adviser,
            title="Pinned",
            pinned=True,
            status="published",
            published_at=now - timedelta(days=1),
        )
        announcement = Announcement.objects.create(
            author=self.adviser, title="Latest", status="published", published_at=now
        )
        Announcement.objects.create(author=self.adviser, title="Draft")
        Announcement.objects.create(
            author=self.adviser,
            title="Expired",
            pinned=True,
            status="published",
            expires=timezone.localdate() - timedelta(days=1),
        )
        public_path = "/api/announcements/?public=1"
        default = self.public.get(public_path).data
        self.assertEqual(default["count"], 2)
        self.assertEqual(
            [result["title"] for result in default["results"]], ["Pinned", "Latest"]
        )
        self.assertEqual(
            self.client.patch(
                "/api/settings/",
                {"announcement_page_size": 1, "highlight_pinned": False},
                format="json",
            ).status_code,
            200,
        )
        public = self.public.get(public_path).data
        self.assertEqual(public["count"], 2)
        self.assertEqual(
            [result["id"] for result in public["results"]], [announcement.pk]
        )
        self.assertEqual(
            self.public.get(public["next"]).data["results"][0]["title"], "Pinned"
        )
        self.assertEqual(
            self.client.get("/api/announcements/?manage=1").data["count"], 4
        )
