from secrets import token_urlsafe
from rest_framework.test import APITestCase, APIClient
from users.models import User
from .models import AuditLog


class AuditLogTests(APITestCase):
    def setUp(self):
        self.adviser = User.objects.create_superuser(
            "adviser", password=token_urlsafe()
        )
        self.officer = User.objects.create_user("officer", role="officer")

    def test_login_logout_and_sanitized_failure(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get("/api/session/").data["csrf"]
        wrong = token_urlsafe()
        self.assertEqual(
            client.post(
                "/api/login/",
                {"username": self.officer.username, "password": wrong},
                HTTP_X_CSRFTOKEN=csrf,
            ).status_code,
            400,
        )
        self.assertIsNone(AuditLog.objects.get(action="FAILED_LOGIN").actor)
        self.officer.set_password("123")
        self.officer.must_change_password = True
        self.officer.save()
        login = client.post(
            "/api/login/",
            {"username": self.officer.username, "password": "123"},
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(
            client.post(
                "/api/logout/", HTTP_X_CSRFTOKEN=login.data["csrf"]
            ).status_code,
            200,
        )
        self.assertEqual(
            list(
                AuditLog.objects.filter(actor=self.officer).values_list(
                    "action", flat=True
                )
            ),
            ["LOGOUT", "LOGIN"],
        )
        self.assertEqual(AuditLog.objects.get(action="LOGIN").actor_role, "officer")
        self.assertNotIn(wrong, str(list(AuditLog.objects.values())))
        self.assertNotIn(
            "123", " ".join(AuditLog.objects.values_list("description", flat=True))
        )

    def test_read_only_pagination_and_role_filter(self):
        for _ in range(22):
            AuditLog.record(
                self.adviser,
                "LOGIN",
                resource="authentication",
                description="Signed in successfully.",
            )
        AuditLog.record(
            self.officer,
            "LOGIN",
            resource="authentication",
            description="Signed in successfully.",
        )
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.get("/api/audit/").status_code, 403)
        self.client.force_authenticate(self.adviser)
        first = self.client.get("/api/audit/?role=adviser&search=login")
        self.assertEqual(first.data["count"], 22)
        self.assertEqual(len(first.data["results"]), 20)
        self.assertIsNone(first.data["previous"])
        self.assertIn("role=adviser", first.data["next"])
        second = self.client.get(first.data["next"])
        self.assertEqual(len(second.data["results"]), 2)
        self.assertIsNone(second.data["next"])
        self.assertEqual(
            self.client.delete(
                f"/api/audit/{second.data['results'][0]['id']}/"
            ).status_code,
            405,
        )

    def test_venue_and_announcement_actions_are_recorded(self):
        self.client.force_authenticate(self.adviser)
        result = self.client.post(
            "/api/venues/", {"name": "New hall", "capacity": 30, "location": "Campus"}
        )
        self.assertEqual(result.status_code, 201)
        self.assertEqual(
            self.client.patch(
                f"/api/venues/{result.data['id']}/", {"available": False}
            ).status_code,
            200,
        )
        self.assertEqual(
            set(
                AuditLog.objects.filter(resource="venue").values_list(
                    "action", flat=True
                )
            ),
            {"Created", "Updated", "Deactivated"},
        )

        result = self.client.post(
            "/api/announcements/",
            {"title": "Notice", "description": "Text", "category": "News"},
        )
        self.assertEqual(result.status_code, 201, result.data)
        path = f"/api/announcements/{result.data['id']}/?manage=1"
        for state in ("published", "draft", "archived"):
            self.assertEqual(
                self.client.patch(path, {"status": state}).status_code, 200
            )
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(
            set(
                AuditLog.objects.filter(resource="announcement").values_list(
                    "action", flat=True
                )
            ),
            {
                "Created",
                "Updated",
                "Published",
                "Unpublished",
                "Archived",
                "Deleted",
            },
        )
