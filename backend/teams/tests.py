from django.urls import reverse
from audit_logs.models import AuditLog
from rest_framework.test import APITestCase

from teams.models import Team
from users.models import User


class TeamMembershipTests(APITestCase):
    def setUp(self):
        self.technical = Team.objects.get(name="Technical Team")
        self.documentation = Team.objects.get(name="Documentation Team")
        self.adviser = User.objects.create_superuser("team-adviser")
        self.officer = User.objects.create_user("team-officer", role="officer")
        self.staff = User.objects.create_user(
            "private-member",
            first_name="Private Member",
            role="staff",
            teams=[self.technical, self.documentation],
        )
        self.team_path = reverse("teams-detail", args=[self.technical.pk])
        self.roster_path = reverse("teams-members", args=[self.technical.pk])
        self.remove_path = reverse(
            "teams-remove-member", args=[self.technical.pk, self.staff.pk]
        )
        self.account_path = reverse("accounts-detail", args=[self.staff.pk])

    def test_only_advisers_create_teams_and_officers_can_still_edit(self):
        payload = {"name": "Logistics", "description": "Coordinates supplies."}
        for user in (None, self.staff, self.officer):
            self.client.force_authenticate(user)
            self.assertEqual(
                self.client.post(reverse("teams-list"), payload).status_code, 403
            )
        self.assertFalse(Team.objects.filter(name=payload["name"]).exists())
        self.client.force_authenticate(self.adviser)
        record = self.client.post(reverse("teams-list"), payload)
        self.assertEqual(record.status_code, 201, record.data)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.adviser,
                resource="team",
                action="Created",
                object_id=record.data["id"],
            ).exists()
        )
        self.client.force_authenticate(self.officer)
        response = self.client.patch(
            reverse("teams-detail", args=[record.data["id"]]),
            {"description": "Revised duty"},
        )
        self.assertEqual(response.status_code, 200)

    def test_student_can_only_read_public_fields(self):
        result = self.client.get(reverse("teams-list"), {"manage": "1"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(set(result.data["results"][0]), {"id", "name", "description"})
        self.assertEqual(
            set(self.client.get(self.team_path).data), {"id", "name", "description"}
        )
        self.assertEqual(self.client.get(self.roster_path).status_code, 403)
        self.assertEqual(self.client.get(self.account_path).status_code, 403)

    def test_staff_can_read_roster_but_cannot_modify_memberships(self):
        self.client.force_authenticate(self.staff)
        result = self.client.get(self.roster_path)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["count"], 1)
        self.assertEqual(
            set(result.data["results"][0]),
            {"id", "full_name", "username", "position", "is_active", "date_joined"},
        )
        self.assertEqual(self.client.delete(self.remove_path).status_code, 403)
        self.assertEqual(
            self.client.patch(
                self.account_path, {"teams": []}, format="json"
            ).status_code,
            403,
        )

    def test_officer_removes_one_membership_and_manager_cannot_remove_last(self):
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.delete(self.remove_path).status_code, 204)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.is_active)
        self.assertEqual(list(self.staff.teams.all()), [self.documentation])
        self.assertEqual(self.client.get(self.roster_path).data["count"], 0)
        self.assertEqual(self.client.get(self.team_path).data["member_count"], 0)
        result = self.client.delete(
            reverse("teams-remove-member", args=[self.documentation.pk, self.staff.pk])
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(list(self.staff.teams.all()), [self.documentation])

    def test_extra_teams_can_be_created_and_retired_with_membership_intact(self):
        self.client.force_authenticate(self.adviser)
        result = self.client.post(
            reverse("teams-list"), {"name": "Creatives", "description": "Campus design"}
        )
        self.assertEqual(result.status_code, 201, result.data)
        team_id = result.data["id"]
        team_path = reverse("teams-detail", args=[team_id])
        self.staff.teams.add(team_id)
        self.assertEqual(self.client.delete(team_path).status_code, 400)
        self.assertEqual(
            self.client.patch(team_path, {"is_active": False}).status_code, 200
        )
        self.assertTrue(self.staff.teams.filter(pk=team_id).exists())
        items = self.client.get(reverse("teams-list")).data["results"]
        self.assertNotIn(team_id, [team["id"] for team in items])
        inactive = self.client.get(reverse("teams-list"), {"inactive": "1"}).data[
            "results"
        ]
        self.assertEqual([team["id"] for team in inactive], [team_id])
        self.assertEqual(
            self.client.patch(self.team_path, {"is_active": False}).status_code, 400
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(team_path).status_code, 404)
