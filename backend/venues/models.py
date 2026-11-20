from django.db import models


class Venue(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=160)
    capacity = models.PositiveIntegerField()
    available = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.CheckConstraint(condition=models.Q(capacity__gt=0), name="positive_venue_capacity")]

    def __str__(self):
        return self.name


class Notice(models.Model):
    venue = models.ForeignKey(Venue, on_delete=models.PROTECT, related_name="notices")
    title = models.CharField(max_length=160)
    description = models.TextField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    blocks_bookings = models.BooleanField(default=False)

    class Meta:
        ordering = ["starts_at", "id"]
        constraints = [models.CheckConstraint(condition=models.Q(ends_at__gt=models.F("starts_at")), name="notice_time_order")]

    def __str__(self):
        return self.title
