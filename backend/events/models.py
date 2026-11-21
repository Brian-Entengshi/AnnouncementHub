from django.conf import settings
from django.db import models


class Event(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField()
    venue = models.ForeignKey(
        "venues.Venue",
        on_delete=models.PROTECT,
        related_name="events",
        null=True,
        blank=True,
    )
    venue_snapshot = models.CharField(max_length=120, blank=True)
    date = models.DateField()
    start = models.TimeField()
    end = models.TimeField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    cancelled = models.BooleanField(default=False)
    activity = models.ForeignKey(
        "activities.Activity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    image = models.ImageField(upload_to="events", blank=True)
    published = models.BooleanField(default=False)

    class Meta:
        ordering = ["date", "start", "pk"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end__gt=models.F("start")), name="event_time_order"
            ),
            models.CheckConstraint(
                condition=models.Q(venue__isnull=False) | ~models.Q(venue_snapshot=""),
                name="event_keeps_venue_name",
            ),
        ]

    def __str__(self):
        return self.title

    @property
    def venue_display_name(self):
        return self.venue.name if self.venue_id is not None else self.venue_snapshot
