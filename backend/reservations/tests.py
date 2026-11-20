from concurrent.futures import ThreadPoolExecutor
from audit_logs.models import AuditLog
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
        self.staff = User.objects.create_user(
            "requester", role="staff", teams=[self.team]
        )
        self.requester = User.objects.create_user("officer-requester", role="officer")
        self.manager = User.objects.create_superuser("reviewer")
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
        self.client.force_authenticate(self.requester)

    def create_booking(self, **kwargs):
        response = self.client.post("/api/reservations/", {**self.data, **kwargs})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def change(self, pk, status, reason=""):
        return self.client.post(
            f"/api/reservations/{pk}/transition/", {"status": status, "reason": reason}
        )


class BookingTests(BookingFixture, APITestCase):
    def test_only_officers_and_advisers_can_submit(self):
        for actor in (None, self.staff):
            self.client.force_authenticate(actor)
            result = self.client.post(
                "/api/reservations/",
                {**self.data, "requester": self.manager.pk, "status": "approved"},
            )
            self.assertEqual(result.status_code, 403)
        self.assertFalse(Reservation.objects.exists())
        self.assertFalse(AuditLog.objects.filter(resource="reservation").exists())
        self.client.force_authenticate(self.requester)
        booking = Reservation.objects.get(pk=self.create_booking(status="approved"))
        self.assertEqual(booking.status, "pending")
        self.assertEqual(booking.requester, self.requester)
        self.assertEqual(self.change(booking.pk, "approved").status_code, 403)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.change(booking.pk, "approved").status_code, 200)

    def test_adviser_booking_has_one_approved_history_and_correct_audit(self):
        self.client.force_authenticate(self.manager)
        booking = Reservation.objects.get(pk=self.create_booking())
        self.assertEqual(booking.requester, self.manager)
        self.assertEqual(booking.status, "approved")
        history = booking.history.get()
        self.assertEqual(history.actor, self.manager)
        self.assertEqual(history.status, "approved")
        self.assertIsNotNone(history.at)
        self.assertIn("Automatically approved", history.reason)
        self.assertCountEqual(
            AuditLog.objects.filter(
                object_id=booking.pk, resource="reservation"
            ).values_list("action", "actor_role"),
            [("Submitted", "adviser"), ("Approved", "adviser")],
        )
        self.assertEqual(
            Notification.objects.get(recipient=self.manager).message,
            "Workshop: approved",
        )
        self.assertEqual(
            self.client.post("/api/reservations/", self.data).status_code, 400
        )

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
                recipient=self.requester, message__contains="approved"
            ).exists()
        )

    def test_time_capacity_closures_and_changes_after_submission(self):
        self.client.force_authenticate(self.manager)
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
        self.client.force_authenticate(self.requester)
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
        self.assertEqual(
            self.client.post("/api/reservations/", self.data).status_code, 400
        )
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
        other = User.objects.create_user("other", role="staff", teams=[self.team])
        self.client.force_authenticate(other)
        self.assertEqual(self.change(pk, "cancelled").status_code, 404)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.change(pk, "rejected").status_code, 400)
        self.assertEqual(
            self.change(pk, "rejected", "Equipment unavailable").status_code, 200
        )
        self.assertEqual(self.change(pk, "approved").status_code, 400)
        self.client.force_authenticate(self.requester)
        pk = self.create_booking()
        self.client.force_authenticate(self.manager)
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
        self.assertEqual(
            set(
                AuditLog.objects.filter(
                    resource="reservation", object_id=pk
                ).values_list("action", flat=True)
            ),
            {"Submitted", "Approved", "Cancelled"},
        )
        self.assertTrue(
            AuditLog.objects.filter(resource="event", action="Cancelled").exists()
        )
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get("/api/events/").data["results"][0]["status"], "cancelled"
        )


class CompetingApprovals(BookingFixture, TransactionTestCase):
    def test_concurrent_adviser_submissions_cannot_double_book(self):
        barrier = Barrier(2)

        def submit(_):
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=self.manager.pk))
                barrier.wait(timeout=10)
                return client.post("/api/reservations/", self.data).status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(submit, range(2)))
        self.assertCountEqual(outcomes, [201, 400])
        self.assertEqual(Reservation.objects.filter(status="approved").count(), 1)

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
