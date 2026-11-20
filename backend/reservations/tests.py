from concurrent.futures import ThreadPoolExecutor
from datetime import time, timedelta
from threading import Barrier
from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from notifications.models import Notification
from users.models import User
from teams.models import Team
from venues.models import Venue, Notice
from .models import Reservation
from .services import local_instant


class BookingFixture:
    def setUp(self):
        self.team, _ = Team.objects.get_or_create(name="Technical Team")
        self.staff = User.objects.create_user("requester", role="staff", team=self.team)
        self.manager = User.objects.create_user("reviewer", role="officer")
        self.venue = Venue.objects.create(name="Hall", location="Campus", capacity=30)
        self.date = timezone.localdate() + timedelta(days=4)
        self.data = dict(
            venue=self.venue.pk,
            date=str(self.date),
            start="09:00",
            end="12:00",
            attendees=20,
            responsible="Event lead",
            contact="Office",
            title="Workshop",
            description="Training",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def create_booking(self, **kwargs):
        response = self.client.post("/api/reservations/", {**self.data, **kwargs})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def change(self, pk, status, reason=""):
        return self.client.post(
            f"/api/reservations/{pk}/transition/", {"status": status, "reason": reason}
        )


class BookingTests(BookingFixture, APITestCase):
    def test_overlap_and_adjacent(self):
        first = self.create_booking()
        second = self.create_booking(start="11:59", end="13:00")
        third = self.create_booking(start="12:00", end="13:00")
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.change(first, "approved").status_code, 200)
        self.assertEqual(self.change(second, "approved").status_code, 400)
        self.assertEqual(self.change(third, "approved").status_code, 200)
        self.assertEqual(
            self.client.post("/api/reservations/", self.data).status_code, 400
        )
        self.assertEqual(Reservation.objects.get(pk=second).history.count(), 1)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.staff, message__contains="approved"
            ).exists()
        )

    def test_time_capacity_closures_and_changes_after_submission(self):
        for invalid in [
            dict(end="08:00"),
            dict(end="09:00"),
            dict(attendees=31),
            dict(attendees=0),
        ]:
            self.assertEqual(
                self.client.post(
                    "/api/reservations/", {**self.data, **invalid}
                ).status_code,
                400,
            )
        pk = self.create_booking()
        self.client.force_authenticate(self.manager)
        start = local_instant(self.date, time(11))
        Notice.objects.create(
            venue=self.venue,
            title="Maintenance",
            description="Closed",
            starts_at=start,
            ends_at=start + timedelta(hours=2),
            blocks_bookings=True,
        )
        self.assertEqual(self.change(pk, "approved").status_code, 400)
        self.venue.available = False
        self.venue.save()
        self.assertEqual(
            self.client.post(
                "/api/reservations/", {**self.data, "start": "14:00", "end": "15:00"}
            ).status_code,
            400,
        )

    def test_status_transitions_and_private_details(self):
        pk = self.create_booking()
        self.assertEqual(self.change(pk, "approved").status_code, 403)
        other = User.objects.create_user("other", role="staff", team=self.team)
        self.client.force_authenticate(other)
        self.assertEqual(self.change(pk, "cancelled").status_code, 404)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.change(pk, "rejected").status_code, 400)
        self.assertEqual(
            self.change(pk, "rejected", "Equipment unavailable").status_code, 200
        )
        self.assertEqual(self.change(pk, "approved").status_code, 400)
        pk = self.create_booking()
        self.assertEqual(self.change(pk, "approved").status_code, 200)
        self.assertEqual(self.change(pk, "completed").status_code, 400)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/reservations/{pk}/").status_code, 403)
        slots = self.client.get(
            "/api/availability/", {"from": self.date, "to": self.date}
        ).data["slots"]
        self.assertEqual(slots[0]["title"], "Reserved")
        self.assertIsNone(slots[0]["id"])

    def test_published_events_derive_booking_times_and_cancellation(self):
        pk = self.create_booking()
        self.client.force_authenticate(self.manager)
        data = dict(
            title="Campus event", description="Welcome", reservation=pk, published=True
        )
        self.assertEqual(self.client.post("/api/events/", data).status_code, 400)
        self.change(pk, "approved")
        result = self.client.post("/api/events/", data)
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["date"], str(self.date))
        self.assertEqual(
            self.client.patch(
                f"/api/venues/{self.venue.pk}/", {"capacity": 1}
            ).status_code,
            400,
        )
        self.assertEqual(self.change(pk, "cancelled").status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get("/api/events/").data["results"][0]["status"], "cancelled"
        )


class CompetingApprovals(BookingFixture, TransactionTestCase):
    def test_only_one_concurrent_approval_commits(self):
        first, second = self.create_booking(), self.create_booking()
        barrier = Barrier(2)

        def approve(pk):
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=self.manager.pk))
                barrier.wait(timeout=10)
                return client.post(
                    f"/api/reservations/{pk}/transition/", {"status": "approved"}
                ).status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(approve, (first, second)))
        self.assertCountEqual(outcomes, [200, 400])
        self.assertEqual(Reservation.objects.filter(status="approved").count(), 1)
