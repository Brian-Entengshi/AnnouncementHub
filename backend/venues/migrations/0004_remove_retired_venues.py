from django.db import migrations


def remove_retired_venues(apps, schema_editor):
    alias = schema_editor.connection.alias
    venues = (
        apps.get_model("venues", "Venue")
        .objects.using(alias)
        .filter(
            name__in=(
                "Seminar Room",
                "Media Studio",
                "Innovation Lab",
                "College Auditorium",
            )
        )
    )
    reservations = apps.get_model("reservations", "Reservation").objects.using(alias)
    notices = apps.get_model("venues", "Notice").objects.using(alias)

    for venue_id, name in list(venues.values_list("id", "name")):
        reservations.filter(venue_id=venue_id).update(
            venue_snapshot=name, venue_id=None
        )
        notices.filter(venue_id=venue_id).update(venue_snapshot=name, venue_id=None)
    venues.delete()


class Migration(migrations.Migration):
    dependencies = [
        (
            "reservations",
            "0003_reservation_venue_snapshot_alter_reservation_venue_and_more",
        ),
        ("venues", "0003_notice_venue_snapshot_alter_notice_venue_and_more"),
    ]

    operations = [migrations.RunPython(remove_retired_venues)]
