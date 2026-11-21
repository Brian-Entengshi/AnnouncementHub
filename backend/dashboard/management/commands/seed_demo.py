from datetime import timedelta, time, datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from activities.models import Activity
from announcements.models import Announcement
from events.models import Event
from teams.models import Team
from users.models import User
from venues.models import Venue, Notice
from useful_links.models import UsefulLink


class Command(BaseCommand):
    help = (
        "Populate an empty hub with sample campus records for the class demonstration."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        if (
            any(
                model.objects.exists()
                for model in (
                    Event,
                    Announcement,
                    Notice,
                    Activity,
                    UsefulLink,
                )
            )
            or User.objects.filter(username="sample-editor").exists()
        ):
            self.stdout.write("Existing records found. Demo initialization skipped.")
            return
        today = timezone.localdate()
        team = Team.objects.get(name="Technical Team")
        author = User.objects.create_user(
            username="sample-editor",
            first_name="DLL Elite Secretariat",
            role="staff",
            teams=[team],
            is_active=False,
        )
        venues = [
            Venue.objects.get(name=name)
            for name in ("Audio-Visual Room (AVR)", "DLL Grounds", "ComLab 1")
        ]
        activity = Activity.objects.create(
            title="Student leadership development",
            description="A term-long series of workshops for student organizers and emerging leaders.",
            start_date=today - timedelta(days=5),
            end_date=today + timedelta(days=28),
            published=True,
        )
        Activity.objects.create(
            title="Campus stories project",
            description="Student teams document the people and projects shaping campus life.",
            start_date=today + timedelta(days=2),
            end_date=today + timedelta(days=32),
            published=True,
        )
        for offset, title, venue, hour, description in [
            (
                1,
                "Leadership skills workshop",
                venues[0],
                9,
                "Practice facilitation and team decision-making through small-group exercises.",
            ),
            (
                3,
                "General assembly",
                venues[1],
                13,
                "Meet the officers and teams, review upcoming initiatives and share your questions.",
            ),
            (
                5,
                "Creative media lab",
                venues[2],
                10,
                "Explore a collaborative workflow for documenting student events.",
            ),
        ]:
            Event.objects.create(
                title=title,
                description=description,
                venue=venue,
                author=author,
                date=today + timedelta(days=offset),
                start=time(hour),
                end=time(hour + 2),
                activity=activity,
                published=True,
            )
        for offset, title, category, text in [
            (
                0,
                "General assembly guidelines",
                "Organization",
                "Bring your student ID and arrive fifteen minutes before the assembly for attendance.",
            ),
            (
                1,
                "Open call for student creatives",
                "Team update",
                "The Editing and Videographer teams welcome student contributors. Visit the organization office to express interest.",
            ),
            (
                2,
                "Workshop materials available",
                "Resources",
                "Members can collect the leadership workshop handouts at the organization office during office hours.",
            ),
        ]:
            Announcement.objects.create(
                title=title,
                description=text,
                category=category,
                author=author,
                status="published",
                pinned=offset == 0,
                published_at=timezone.now() - timedelta(days=offset),
            )
        starts = timezone.make_aware(
            datetime.combine(today + timedelta(days=4), time(8))
        )
        Notice.objects.create(
            venue=venues[2],
            title="ComLab 1 equipment maintenance",
            description="The lab is temporarily closed for a scheduled equipment inspection.",
            starts_at=starts,
            ends_at=starts + timedelta(hours=4),
            publication_status="published",
            published_at=timezone.now(),
            author=author,
        )
        UsefulLink.objects.create(
            title="Google Scholar",
            url="https://scholar.google.com",
            description="Find research for workshops and organization projects.",
            category="Research",
            is_public=True,
        )
        self.stdout.write(
            "Demo records created. The sample author is inactive and has no usable password."
        )
