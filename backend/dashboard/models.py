from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class HubSettings(models.Model):
    class HeroSection(models.TextChoices):
        EVENTS = "events", "Club Events"
        ABOUT = "about", "About"
        ANNOUNCEMENTS = "announcements", "Announcements"
        CONTACTS = "contacts", "Contacts"

    hero_heading = models.CharField(
        max_length=120, default="Club events and campus announcements"
    )
    hero_welcome = models.CharField(
        max_length=120, blank=True, default="DLL Elite Student Organization"
    )
    hero_description = models.CharField(
        max_length=600,
        blank=True,
        default="Find out what’s happening with DLL Elite, where to go, and when to be there.",
    )
    hero_cta_label = models.CharField(max_length=60, default="Explore Club Events")
    hero_cta_section = models.CharField(
        max_length=20, choices=HeroSection, default=HeroSection.EVENTS
    )
    hero_image = models.ImageField(upload_to="landing", blank=True)
    hero_image_alt = models.CharField(max_length=160, blank=True)

    about_heading = models.CharField(max_length=120, default="About DLL Elite")
    about_intro = models.CharField(
        max_length=300,
        blank=True,
        default="DLL Elite stands for Elevating Leaders Innovatively, Training & Excellence.",
    )
    about_description = models.CharField(
        max_length=1200,
        blank=True,
        default=(
            "The Student Club Events & Announcement Hub brings campus activity schedules "
            "and organization announcements together so students can follow the club’s "
            "work and find the details they need to attend."
        ),
    )
    about_purpose = models.CharField(max_length=600, blank=True)
    about_mission = models.CharField(max_length=600, blank=True)
    about_vision = models.CharField(max_length=600, blank=True)

    contact_heading = models.CharField(max_length=120, default="Contacts")
    contact_intro = models.CharField(
        max_length=300, blank=True, default="Get in touch with DLL Elite."
    )
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    office_location = models.CharField(max_length=200, blank=True)
    office_hours = models.CharField(max_length=160, blank=True)
    facebook_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)

    highlight_pinned = models.BooleanField(default=True)
    announcement_page_size = models.PositiveSmallIntegerField(
        default=6, validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    announcement_page_size__gte=1, announcement_page_size__lte=12
                ),
                name="hub_landing_announcement_page_size",
            ),
        ]

    @classmethod
    def current(cls):
        return cls.objects.filter(pk=1).first() or cls(pk=1)


class DemoProgramEntry(models.Model):
    """Installation marker that survives edits or deletion of the sample records."""

    key = models.CharField(max_length=40, unique=True)
