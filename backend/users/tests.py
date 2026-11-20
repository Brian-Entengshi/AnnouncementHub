from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from secrets import token_urlsafe
from teams.models import Team

User = get_user_model()


class AccountTests(APITestCase):
    def setUp(self):
        self.team = Team.objects.get(name="Technical Team")
        self.adviser = User.objects.create_superuser("adviser")
        self.officer = User.objects.create_user("officer", role="officer")
        self.staff = User.objects.create_user("staff", role="staff", team=self.team)
        self.initial = token_urlsafe()
        self.data = dict(
            full_name="New Member",
            username="new.member",
            role="staff",
            team=self.team.pk,
            password=self.initial,
        )
        self.url = reverse("accounts-list")

    def test_adviser_provisions_officer_and_staff(self):
        self.client.force_authenticate(self.adviser)
        for role in ["staff", "officer"]:
            response = self.client.post(
                self.url, {**self.data, "role": role, "username": role + "2"}
            )
            self.assertEqual(response.status_code, 201, response.data)
            self.assertNotIn("password", response.data)
            user = User.objects.get(pk=response.data["id"])
            self.assertTrue(user.check_password(self.initial))
            self.assertTrue(user.must_change_password)
            self.assertEqual(user.created_by, self.adviser)

    def test_officer_cannot_create_or_promote_administrators(self):
        self.client.force_authenticate(self.officer)
        for role in ["adviser", "officer"]:
            self.assertEqual(
                self.client.post(self.url, {**self.data, "role": role}).status_code, 400
            )
            self.assertEqual(
                self.client.patch(
                    reverse("accounts-detail", args=[self.staff.pk]), {"role": role}
                ).status_code,
                400,
            )
        self.assertEqual(self.client.post(self.url, self.data).status_code, 201)
        self.assertEqual(
            self.client.patch(
                reverse("accounts-detail", args=[self.adviser.pk]), {"is_active": False}
            ).status_code,
            404,
        )

    def test_public_and_staff_cannot_provision(self):
        for user in (None, self.staff):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(self.url, self.data).status_code, 403)

    def test_staff_must_have_team(self):
        self.client.force_authenticate(self.adviser)
        self.assertEqual(
            self.client.post(
                self.url, {k: v for k, v in self.data.items() if k != "team"}
            ).status_code,
            400,
        )

    def test_login_csrf_rotation_password_change_and_deactivation(self):
        self.staff.set_password(self.initial)
        self.staff.must_change_password = True
        self.staff.save()
        client = APIClient(enforce_csrf_checks=True)
        payload = {"username": self.staff.username, "password": self.initial}
        self.assertEqual(client.post("/api/login/", payload).status_code, 403)
        csrf = client.get("/api/session/").data["csrf"]
        result = client.post("/api/login/", payload, HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(client.get("/api/reservations/").status_code, 403)
        result = client.post(
            "/api/password/",
            {"current_password": self.initial, "new_password": token_urlsafe()},
            HTTP_X_CSRFTOKEN=result.data["csrf"],
        )
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(client.get("/api/reservations/").status_code, 200)
        self.staff.is_active = False
        self.staff.save(update_fields=["is_active"])
        self.assertEqual(client.get("/api/reservations/").status_code, 403)
