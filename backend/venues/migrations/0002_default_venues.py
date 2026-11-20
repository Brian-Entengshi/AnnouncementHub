from django.db import migrations, models


def replace_defaults(apps, schema_editor):
    venues = apps.get_model("venues", "Venue").objects.using(
        schema_editor.connection.alias
    )
    venues.filter(
        name__in=[
            "College Auditorium",
            "Innovation Lab",
            "Media Studio",
            "Seminar Room",
        ]
    ).update(archived=True, available=False)

    defaults = [
        ("Audio-Visual Room (AVR)", "DLL campus", 60),
        ("DLL Grounds", "DLL campus", 220),
        *((f"ComLab {number}", "DLL campus", 40) for number in range(1, 6)),
    ]
    for name, location, capacity in defaults:
        existing = (
            venues.filter(name=name).first()
            or venues.filter(name__iexact=name).order_by("pk").first()
        )
        if existing is not None:
            venues.filter(pk=existing.pk).update(name=name)
        else:
            venues.create(name=name, location=location, capacity=capacity)


class Migration(migrations.Migration):
    dependencies = [("venues", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="venue",
            name="archived",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(replace_defaults, migrations.RunPython.noop),
    ]
