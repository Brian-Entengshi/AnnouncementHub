from django.db import models


class Activity(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField()
    start_date = models.DateField()
    end_date = models.DateField()
    image = models.ImageField(upload_to="activities", blank=True)
    published = models.BooleanField(default=False)

    class Meta:
        ordering = ["start_date", "pk"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="activity_date_order",
            )
        ]

    def __str__(self):
        return self.title
