from datetime import timedelta
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase
from teams.models import Team
from users.models import User


class ContentTests(APITestCase):
    def setUp(self):
        self.editor = User.objects.create_user("adviser", role="adviser")
        self.client.force_authenticate(self.editor)

    def test_demo_staff_seeds_active_and_additional_teams_without_duplicates(self):
        extra = Team.objects.create(name="Campus outreach")
        inactive = Team.objects.create(name="Retired crew", is_active=False)
        technical = Team.objects.get(name="Technical Team")
        original = User.objects.create_user(
            "original-member", role="staff", teams=[technical]
        )
        call_command("seed_demo_staff")
        generated = User.objects.filter(username__startswith="demo_team_")
        before = set(generated.values_list("id", flat=True))
        self.assertTrue(before)
        self.assertFalse(
            generated.exclude(role="staff", email__endswith="@example.test").exists()
        )
        self.assertTrue(all(not account.has_usable_password() for account in generated))
        self.assertTrue(
            any(
                account.teams.count() > 1
                for account in generated.prefetch_related("teams")
            )
        )
        self.assertEqual(inactive.staff_members.count(), 0)
        self.assertEqual(extra.staff_members.count(), 17)
        for team in Team.objects.filter(is_active=True):
            self.assertEqual(
                team.staff_members.filter(role="staff", is_active=True).count(), 17
            )
        call_command("seed_demo_staff")
        self.assertEqual(set(generated.values_list("id", flat=True)), before)
        self.assertEqual(list(original.teams.all()), [technical])

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


class DemoProgramTests(APITestCase):
    def test_seed_program_is_idempotent_and_public(self):
        from django.core.management import call_command
        from activities.models import Activity
        from events.models import Event
        from .models import DemoProgramEntry

        adviser = User.objects.create_superuser("program-adviser")
        call_command("seed_program", adviser=adviser.username, verbosity=0)
        self.assertEqual(DemoProgramEntry.objects.count(), 7)
        event = Event.objects.get(title="Campus organization briefing")
        self.assertTrue(event.published)
        self.assertEqual(event.reservation.status, "approved")
        self.assertEqual(event.reservation.history.count(), 2)
        self.assertFalse(event.reservation.venue.archived)
        event.activity.title = "Edited orientation"
        event.activity.save(update_fields=["title"])
        call_command("seed_program", adviser=adviser.username, verbosity=0)
        self.assertEqual(Event.objects.count(), 7)
        self.assertEqual(Activity.objects.count(), 7)
        self.assertTrue(Activity.objects.filter(title="Edited orientation").exists())
        self.assertEqual(self.client.get("/api/events/").data["count"], 7)
        self.assertEqual(self.client.get("/api/activities/").data["count"], 7)

    def test_help_is_only_available_to_student_access(self):
        self.assertEqual(self.client.get("/api/help/").status_code, 200)
        self.assertEqual(self.client.get("/api/settings/").status_code, 403)
        self.client.force_authenticate(
            User.objects.create_user("officer", role="officer")
        )
        self.assertEqual(self.client.get("/api/help/").status_code, 403)
        self.assertEqual(self.client.get("/api/settings/").status_code, 403)
        self.client.force_authenticate(User.objects.create_superuser("help-adviser"))
        self.assertEqual(
            self.client.patch(
                "/api/settings/", {"office_hours": "Monday, 09:00–12:00"}
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/help/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get("/api/help/").data["office_hours"], "Monday, 09:00–12:00"
        )


class DemoVenueNoticeTests(APITestCase):
    def test_notice_seed_is_idempotent_and_uses_bookable_venues(self):
        from django.core.management import call_command
        from io import StringIO
        from venues.models import Notice

        output = StringIO()
        call_command("seed_venue_notices", stdout=output)
        self.assertIn("Added 10", output.getvalue())
        self.assertEqual(Notice.objects.count(), 10)
        self.assertEqual(Notice.objects.values("venue").distinct().count(), 7)
        self.assertFalse(Notice.objects.filter(venue__archived=True).exists())
        self.assertFalse(Notice.objects.filter(venue__available=False).exists())
        public = self.client.get("/api/notices/").data
        self.assertEqual(public["count"], 9)
        self.assertEqual(
            {n["status"] for n in public["results"]}, {"current", "upcoming"}
        )

        self.client.force_authenticate(User.objects.create_superuser("notice-adviser"))
        self.assertEqual(
            self.client.get("/api/notices/?manage=1&status=expired").data["count"], 1
        )
        first = Notice.objects.first()
        first.title = "Edited notice"
        first.save(update_fields=["title"])
        call_command("seed_venue_notices", stdout=output)
        self.assertIn("Added 0", output.getvalue())
        self.assertEqual(Notice.objects.count(), 10)
        self.assertTrue(Notice.objects.filter(title="Edited notice").exists())
