import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("venues", "0004_retired_venues_transition"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AddField(
            model_name="notice",
            name="publication_status",
            field=models.CharField(
                max_length=10,
                choices=[
                    ("draft", "Draft"),
                    ("published", "Published"),
                    ("archived", "Archived"),
                ],
                default="published",
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="notice",
            name="publication_status",
            field=models.CharField(
                max_length=10,
                choices=[
                    ("draft", "Draft"),
                    ("published", "Published"),
                    ("archived", "Archived"),
                ],
                default="draft",
            ),
        ),
        migrations.AddField(
            model_name="notice",
            name="published_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="notice",
            name="author",
            field=models.ForeignKey(
                settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
            ),
        ),
        migrations.RemoveField(model_name="notice", name="blocks_bookings"),
    ]
