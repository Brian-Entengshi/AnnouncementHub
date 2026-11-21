from rest_framework.test import APITestCase

from audit_logs.models import AuditLog
from teams.models import Team
from users.models import User
from .models import UsefulLink


class UsefulLinkPublicationTests(APITestCase):
    def setUp(self):
        self.adviser = User.objects.create_superuser("links-adviser")
        self.officer = User.objects.create_user("links-officer", role="officer")
        self.staff = User.objects.create_user(
            "links-staff", role="staff", teams=[Team.objects.first()]
        )
        self.public = UsefulLink.objects.create(
            title="Campus library",
            description="Browse research materials",
            url="https://example.com/library",
            category="Research",
            is_public=True,
        )
        self.internal = UsefulLink.objects.create(
            title="Officer documents",
            description="Research notes",
            url="https://example.com/officers",
            category="Internal",
        )
        self.path = "/api/links/"

    def detail(self, link):
        return f"{self.path}{link.pk}/"

    def test_public_queries_exclude_internal_links_and_metadata(self):
        response = self.client.get(self.path, {"manage": "1", "search": "research"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        result = response.data["results"][0]
        self.assertEqual(result["id"], self.public.pk)
        self.assertEqual(set(result), {"id", "title", "description", "url", "category"})
        self.assertEqual(self.client.get(self.detail(self.public)).data, result)
        self.assertEqual(self.client.get(self.detail(self.internal)).status_code, 404)
        self.assertEqual(
            self.client.get(self.path, {"category": "Internal"}).data["count"], 0
        )
        self.assertEqual(self.client.get(self.path + "categories/").data, ["Research"])

    def test_member_directory_remains_read_only_and_explicit_public_view_is_scoped(
        self,
    ):
        for person in (self.adviser, self.officer, self.staff):
            self.client.force_authenticate(person)
            response = self.client.get(self.path)
            self.assertEqual(response.data["count"], 2)
            self.assertEqual(
                self.client.get(self.detail(self.internal)).data["is_public"], False
            )
            public = self.client.get(
                self.path, {"manage": "1", "public": "1", "is_public": "false"}
            )
            self.assertEqual(public.data["count"], 0)
            self.assertEqual(
                self.client.get(
                    self.detail(self.internal), {"public": "1"}
                ).status_code,
                404,
            )
            self.assertEqual(
                self.client.get(self.path + "categories/", {"public": "1"}).data,
                ["Research"],
            )
        self.client.force_authenticate(self.adviser)
        for value, expected in (("true", self.public), ("false", self.internal)):
            result = self.client.get(self.path, {"is_public": value})
            self.assertEqual(
                [item["id"] for item in result.data["results"]], [expected.pk]
            )
        self.assertEqual(
            self.client.get(self.path, {"is_public": "invalid"}).status_code, 400
        )
        for person in (self.staff, None):
            self.client.force_authenticate(person)
            self.assertEqual(self.client.post(self.path, {}).status_code, 403)
            self.assertEqual(
                self.client.patch(
                    self.detail(self.internal), {"is_public": True}
                ).status_code,
                403,
            )
            self.assertEqual(
                self.client.delete(self.detail(self.public)).status_code, 403
            )

    def test_managers_can_publish_update_and_remove_links_and_changes_are_audited(self):
        self.client.force_authenticate(self.adviser)
        payload = {
            "title": "Student resources",
            "category": "Services",
            "url": "https://example.com/students#resources",
        }
        created = self.client.post(self.path, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertFalse(created.data["is_public"])
        detail = f"{self.path}{created.data['id']}/"
        self.client.force_authenticate(self.officer)
        self.assertEqual(
            self.client.patch(detail, {"is_public": True}, format="json").status_code,
            200,
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(detail).data["url"], payload["url"])
        self.assertIn(
            payload["category"], self.client.get(self.path + "categories/").data
        )
        self.client.force_authenticate(self.adviser)
        self.assertEqual(self.client.delete(detail).status_code, 204)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(detail).status_code, 404)
        records = AuditLog.objects.filter(
            resource="useful link", object_id=created.data["id"]
        )
        self.assertCountEqual(
            records.values_list("actor__username", "action"),
            [
                (self.adviser.username, "Created"),
                (self.officer.username, "Updated"),
                (self.adviser.username, "Deleted"),
            ],
        )

    def test_invalid_destinations_cannot_be_created_or_published(self):
        self.client.force_authenticate(self.adviser)
        for url in (
            "ftp://example.com/resource",
            "javascript:alert(1)",
            "https:///missing-host",
            "https://user:password@example.com/resource",
        ):
            result = self.client.post(
                self.path,
                {"title": "Invalid", "category": "Resources", "url": url},
                format="json",
            )
            self.assertEqual(result.status_code, 400, result.data)
            self.assertIn("url", result.data)
        legacy = UsefulLink.objects.create(
            title="Legacy",
            category="Internal",
            url="https://user:password@example.com/resource",
        )
        result = self.client.patch(
            self.detail(legacy), {"is_public": True}, format="json"
        )
        self.assertEqual(result.status_code, 400, result.data)
        self.assertIn("url", result.data)
