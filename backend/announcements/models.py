from django.conf import settings
from django.db import models
from django.utils import timezone


class Announcement(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField()
    category = models.CharField(max_length=60)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=12, choices=[(s, s.title()) for s in ("draft", "published", "archived")], default="draft")
    pinned = models.BooleanField(default=False)
    published_at = models.DateTimeField(default=timezone.now)
    expires = models.DateField(null=True, blank=True)
    image = models.ImageField(upload_to="announcements", blank=True)
    attachment = models.FileField(upload_to="attachments", blank=True)

    class Meta:
        ordering = ["-pinned", "-published_at", "-pk"]

    def __str__(self):
        return self.title
