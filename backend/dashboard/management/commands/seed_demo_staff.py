from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, Q

from teams.models import Team
from users.models import User

TARGET = 17
GIVEN_NAMES = (
    "Alina",
    "Belen",
    "Celia",
    "Dario",
    "Elian",
    "Faye",
    "Gio",
    "Hana",
    "Ivo",
    "Jana",
    "Kian",
    "Lara",
    "Miko",
    "Nena",
    "Orin",
    "Pia",
    "Rian",
    "Sela",
    "Tala",
)
FAMILY_NAMES = (
    "Aguilar",
    "Bautista",
    "Cruz",
    "Dalisay",
    "Estrella",
    "Flores",
    "Garcia",
    "Hilario",
    "Ilagan",
    "Javier",
    "Luna",
    "Mendoza",
    "Navarro",
    "Ocampo",
    "Pascual",
    "Quinto",
    "Reyes",
    "Santos",
    "Villanueva",
)
POSITIONS = (
    "Team support",
    "Production assistant",
    "Project volunteer",
    "Workshop aide",
)


class Command(BaseCommand):
    help = "Top up each active roster with fictional Staff members for the demo."

    @transaction.atomic
    def handle(self, *args, **options):
        teams = list(
            Team.objects.select_for_update().filter(is_active=True).order_by("pk")
        )
        counts = dict(
            Team.objects.filter(is_active=True)
            .annotate(
                staff_count=Count(
                    "staff_members",
                    filter=Q(
                        staff_members__role="staff", staff_members__is_active=True
                    ),
                )
            )
            .values_list("pk", "staff_count")
        )
        added = 0
        for index, team in enumerate(teams):
            sequence = 0
            partner = teams[(index + 1) % len(teams)]
            while counts[team.pk] < TARGET:
                sequence += 1
                username = f"demo_team_{team.pk}_{sequence:03d}"
                if User.objects.filter(username=username).exists():
                    continue
                assigned = [team]
                if sequence == 1 and partner != team and counts[partner.pk] < TARGET:
                    assigned.append(partner)
                    counts[partner.pk] += 1
                number = (team.pk - 1) * TARGET + sequence - 1
                User.objects.create_user(
                    username,
                    first_name=GIVEN_NAMES[number % len(GIVEN_NAMES)],
                    last_name=FAMILY_NAMES[
                        (number // len(GIVEN_NAMES) + number) % len(FAMILY_NAMES)
                    ],
                    email=f"{username}@example.test",
                    role="staff",
                    position=POSITIONS[number % len(POSITIONS)],
                    teams=assigned,
                )
                counts[team.pk] += 1
                added += 1
        self.stdout.write(f"Created {added} demonstration Staff accounts.")
        for team in teams:
            total = team.staff_members.filter(role="staff").count()
            self.stdout.write(
                f"{team.name} | {counts[team.pk]} active, {total} assigned"
            )
