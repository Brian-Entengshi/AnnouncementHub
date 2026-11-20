from django.db import models


class Event(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField()
    reservation = models.OneToOneField(
        "reservations.Reservation", on_delete=models.PROTECT, related_name="event"
    )
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
        ordering = ["reservation__date", "reservation__start", "pk"]

    def __str__(self):
        return self.title
