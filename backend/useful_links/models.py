from django.db import models


class UsefulLink(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    url = models.URLField()
    category = models.CharField(max_length=60)
    is_public = models.BooleanField(default=False)

    class Meta:
        ordering = ["category", "title", "pk"]

    def __str__(self):
        return self.title
