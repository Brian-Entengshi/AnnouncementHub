from django.conf import settings
from django.db import models


class Reservation(models.Model):
    STATES = [
        (s, s.title())
        for s in ("pending", "approved", "rejected", "cancelled", "completed")
    ]
    title = models.CharField(max_length=160)
    description = models.TextField()
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    team = models.ForeignKey(
        "teams.Team", on_delete=models.PROTECT, null=True, blank=True
    )
    venue = models.ForeignKey(
        "venues.Venue",
        on_delete=models.PROTECT,
        related_name="reservations",
        null=True,
        blank=True,
    )
    venue_snapshot = models.CharField(max_length=120, blank=True)
    date = models.DateField()
    start = models.TimeField()
    end = models.TimeField()
    attendees = models.PositiveIntegerField()
    responsible = models.CharField(max_length=120)
    contact = models.CharField(max_length=120)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "start", "pk"]
        indexes = [models.Index(fields=["venue", "date", "status"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end__gt=models.F("start")),
                name="reservation_time_order",
            ),
            models.CheckConstraint(
                condition=models.Q(attendees__gt=0), name="positive_attendance"
            ),
            models.CheckConstraint(
                condition=models.Q(venue__isnull=False) | ~models.Q(venue_snapshot=""),
                name="reservation_keeps_venue_name",
            ),
        ]

    def __str__(self):
        return self.title

    @property
    def venue_display_name(self):
        return self.venue.name if self.venue_id is not None else self.venue_snapshot


class StatusChange(models.Model):
    reservation = models.ForeignKey(
        Reservation, related_name="history", on_delete=models.CASCADE
    )
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=10)
    reason = models.TextField(blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["at", "id"]
