from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from secrets import token_urlsafe
from teams.models import Team
from audit_logs.models import AuditLog

User = get_user_model()


class AccountTests(APITestCase):
    def setUp(self):
        self.team = Team.objects.get(name="Technical Team")
        self.adviser = User.objects.create_superuser("adviser")
        self.officer = User.objects.create_user("officer", role="officer")
        self.staff = User.objects.create_user("staff", role="staff", teams=[self.team])
        self.initial = "123"
        self.data = dict(
            full_name="New Member",
            username="new.member",
            role="staff",
            teams=[self.team.pk],
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
            self.assertNotEqual(user.password, self.initial)
            self.assertEqual(
                list(user.teams.all()), [self.team] if role == "staff" else []
            )
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
                self.url, {k: v for k, v in self.data.items() if k != "teams"}
            ).status_code,
            400,
        )

    def test_multiple_assignments_are_unique_and_updates_preserve_existing_memberships(
        self,
    ):
        self.client.force_authenticate(self.adviser)
        extra = Team.objects.create(name="Campus communications")
        inactive = Team.objects.create(name="Retired crew", is_active=False)
        result = self.client.post(
            self.url, {**self.data, "teams": [self.team.pk, extra.pk]}, format="json"
        )
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(set(result.data["teams"]), {self.team.pk, extra.pk})
        self.assertEqual(
            {item["name"] for item in result.data["assigned_teams"]},
            {self.team.name, extra.name},
        )
        path = reverse("accounts-detail", args=[result.data["id"]])
        for invalid in ([], [self.team.pk, self.team.pk], [inactive.pk]):
            result = self.client.patch(path, {"teams": invalid}, format="json")
            self.assertEqual(result.status_code, 400, result.data)
        updated = self.client.patch(path, {"is_active": False}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(set(updated.data["teams"]), {self.team.pk, extra.pk})
        result = self.client.get(self.url, {"team_id": extra.pk, "status": "inactive"})
        self.assertEqual(
            [user["username"] for user in result.data["results"]], ["new.member"]
        )
        extra.is_active = False
        extra.save()
        updated = self.client.patch(path, {"teams": [extra.pk]}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["teams"], [extra.pk])

    def test_account_edit_audits_the_specific_teams_added_and_removed(self):
        self.client.force_authenticate(self.officer)
        documentation = Team.objects.get(name="Documentation Team")
        editing = Team.objects.get(name="Editing Team")
        self.staff.teams.add(documentation)
        path = reverse("accounts-detail", args=[self.staff.pk])

        response = self.client.patch(path, {"teams": [editing.pk, documentation.pk]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(response.data["teams"]), {editing.pk, documentation.pk})
        audit_entries = AuditLog.objects.filter(
            actor=self.officer,
            resource="account",
            object_id=self.staff.pk,
            action="Team assignment changed",
        )
        self.assertEqual(
            audit_entries.get().description,
            "Assigned to Editing Team. Removed membership in Technical Team.",
        )

        response = self.client.patch(path, {"teams": [documentation.pk, editing.pk]})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(audit_entries.count(), 1)

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
        self.assertEqual(client.get("/api/dashboard/").status_code, 403)
        result = client.post(
            "/api/password/",
            {"current_password": self.initial, "new_password": token_urlsafe()},
            HTTP_X_CSRFTOKEN=result.data["csrf"],
        )
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(client.get("/api/dashboard/").status_code, 200)
        self.staff.is_active = False
        self.staff.save(update_fields=["is_active"])
        self.assertEqual(client.get("/api/dashboard/").status_code, 403)

    def test_replacement_accepts_short_password_and_keeps_permanent_policy(self):
        self.client.force_authenticate(self.officer)
        path = reverse("accounts-detail", args=[self.staff.pk])
        original = self.staff.password
        self.assertEqual(
            self.client.patch(path, {"password": ""}, format="json").status_code, 200
        )
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.password, original)
        self.assertFalse(AuditLog.objects.filter(action="Password replaced").exists())
        result = self.client.patch(path, {"password": "123"})
        self.assertEqual(result.status_code, 200, result.data)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password("123"))
        self.assertNotEqual(self.staff.password, "123")
        self.assertTrue(self.staff.must_change_password)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.officer,
                resource="account",
                action="Password replaced",
                object_id=self.staff.pk,
            ).exists()
        )

        client = APIClient()
        self.assertEqual(
            client.post(
                "/api/login/", {"username": self.staff.username, "password": "123"}
            ).status_code,
            200,
        )
        self.assertEqual(client.get("/api/dashboard/").status_code, 403)
        weak = client.post(
            "/api/password/", {"current_password": "123", "new_password": "1234"}
        )
        self.assertEqual(weak.status_code, 400)
        changed = client.post(
            "/api/password/",
            {"current_password": "123", "new_password": token_urlsafe()},
        )
        self.assertEqual(changed.status_code, 200)
        self.assertFalse(changed.data["user"]["must_change_password"])
        self.assertEqual(client.get("/api/dashboard/").status_code, 200)

    def test_role_change_clears_staff_assignments_and_active_new_team_is_allowed(self):
        self.client.force_authenticate(self.adviser)
        result = self.client.patch(
            reverse("accounts-detail", args=[self.staff.pk]), {"role": "officer"}
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["teams"], [])
        extra = Team.objects.create(name="Non-core team")
        result = self.client.post(
            self.url, {**self.data, "teams": [extra.pk]}, format="json"
        )
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["teams"], [extra.pk])

    def test_temporary_passwords_create_and_replace_without_normalization(self):
        self.client.force_authenticate(self.adviser)
        examples = (
            "1",
            "12",
            "123",
            "1234",
            "a",
            "abc",
            "password",
            "elite",
            "elite123",
            "A",
            "a1",
            "  Ab1  ",
            " ",
        )
        for role in ("staff", "officer"):
            for index, password in enumerate(examples):
                with self.subTest(role=role, index=index):
                    result = self.client.post(
                        self.url,
                        {
                            **self.data,
                            "username": f"{role}-{index}",
                            "role": role,
                            "password": password,
                        },
                        format="json",
                    )
                    self.assertEqual(result.status_code, 201, result.data)
                    self.assertNotIn("password", result.data)
                    account = User.objects.get(pk=result.data["id"])
                    self.assertTrue(account.check_password(password))
                    changed = self.client.patch(
                        reverse("accounts-detail", args=[account.pk]),
                        {"password": examples[(index + 2) % len(examples)]},
                        format="json",
                    )
                    self.assertEqual(changed.status_code, 200, changed.data)
                    account.refresh_from_db()
                    self.assertTrue(
                        account.check_password(examples[(index + 2) % len(examples)])
                    )
                    self.assertTrue(account.must_change_password)

        payload = {**self.data, "password": ""}
        self.assertEqual(
            self.client.post(self.url, payload, format="json").status_code, 400
        )
        payload.pop("password")
        self.assertEqual(
            self.client.post(self.url, payload, format="json").status_code, 400
        )

    def test_ordinary_account_edit_preserves_hash_with_multipart_or_json(self):
        self.client.force_authenticate(self.adviser)
        self.staff.set_password("  a  ")
        self.staff.save()
        original = self.staff.password
        path = reverse("accounts-detail", args=[self.staff.pk])
        for payload, encoding in [
            ({"position": "Coordinator"}, "json"),
            ({"position": "Committee lead", "password": ""}, "multipart"),
            ({"position": "Member", "password": ""}, "json"),
        ]:
            self.assertEqual(
                self.client.patch(path, payload, format=encoding).status_code, 200
            )
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.password, original)
        self.assertFalse(AuditLog.objects.filter(action="Password replaced").exists())
