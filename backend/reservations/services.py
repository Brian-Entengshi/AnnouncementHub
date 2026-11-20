from datetime import datetime
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from venues.models import Notice, Venue
from audit_logs.models import AuditLog
from notifications.models import Notification
from .models import Reservation, StatusChange


def local_instant(date, time):
    return timezone.make_aware(datetime.combine(date, time))


def check_slot(venue, date, start, end, attendees, excluding=None, *, lock_venue=False):
    if end <= start:
        raise ValidationError({"end": "End time must be after start time."})
    if local_instant(date, start) <= timezone.now():
        raise ValidationError({"date": "Select a future start time."})
    if lock_venue and venue is not None:
        # Hold the venue lock through the availability check and status write.
        venue = Venue.objects.select_for_update().filter(pk=venue.pk).first()
    if venue is None or venue.archived or not venue.available:
        raise ValidationError({"venue": "This venue is unavailable."})
    if not 0 < attendees <= venue.capacity:
        raise ValidationError(
            {"attendees": f"Choose between 1 and {venue.capacity} attendees."}
        )
    if Notice.objects.filter(
        venue=venue,
        blocks_bookings=True,
        starts_at__lt=local_instant(date, end),
        ends_at__gt=local_instant(date, start),
    ).exists():
        raise ValidationError({"venue": "A venue closure overlaps this time."})
    if (
        Reservation.objects.filter(
            venue=venue, date=date, status="approved", start__lt=end, end__gt=start
        )
        .exclude(pk=excluding)
        .exists()
    ):
        raise ValidationError({"venue": "An approved reservation overlaps this time."})


def record_status(reservation, actor, reason="", *, automatic=False):
    if automatic:
        reason = "Automatically approved on submission by the adviser."
    StatusChange.objects.create(
        reservation=reservation, actor=actor, status=reservation.status, reason=reason
    )
    text = f"{reservation.title}: {reservation.status}"
    Notification.objects.create(
        recipient=reservation.requester,
        message=text,
        link=f"/reservations/{reservation.pk}",
    )
    if reservation.status == "pending":
        from users.models import User

        reviewers = User.objects.filter(
            is_active=True, role__in=["adviser", "officer"]
        ).exclude(pk=reservation.requester_id)
        Notification.objects.bulk_create(
            [
                Notification(
                    recipient=u, message=text, link=f"/reservations/{reservation.pk}"
                )
                for u in reviewers
            ]
        )
    action = (
        "Submitted" if reservation.status == "pending" else reservation.status.title()
    )
    AuditLog.record(actor, action, reservation, description=reason if automatic else "")


def approve_booking(reservation, actor, reason=""):
    """Validate the slot inside the caller's write transaction before approving it."""
    check_slot(
        reservation.venue,
        reservation.date,
        reservation.start,
        reservation.end,
        reservation.attendees,
        excluding=reservation.pk,
        lock_venue=True,
    )
    reservation.status = "approved"
    reservation.save(update_fields=["status"])
    record_status(reservation, actor, reason)
