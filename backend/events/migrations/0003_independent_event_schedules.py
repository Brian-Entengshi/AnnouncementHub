import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_schedules(apps, schema_editor):
    db = schema_editor.connection.alias
    events = apps.get_model("events", "Event").objects.using(db)
    notices = apps.get_model("venues", "Notice").objects.using(db)
    logs = apps.get_model("audit_logs", "AuditLog").objects.using(db)
    with schema_editor.connection.cursor() as cursor:
        if (
            "reservations_reservation"
            in schema_editor.connection.introspection.table_names(cursor)
        ):
            cursor.execute(
                """SELECT e.id, r.date, r.start, r.end, r.venue_id, r.venue_snapshot, r.status
                FROM events_event e JOIN reservations_reservation r ON e.reservation_id = r.id"""
            )
            schedules = cursor.fetchall()
        else:
            schedules = []
    if len(schedules) != events.count():
        raise RuntimeError(
            "Every existing event needs a schedule before the old tables can be removed."
        )
    authors = {}
    for pk, author in (
        logs.filter(resource="event", action="Created", actor_id__isnull=False)
        .order_by("id")
        .values_list("object_id", "actor_id")
    ):
        authors.setdefault(pk, author)
    for pk, day, start, end, venue, snapshot, status in schedules:
        events.filter(pk=pk).update(
            date=day,
            start=start,
            end=end,
            venue_id=venue,
            venue_snapshot=snapshot,
            cancelled=status == "cancelled",
            author_id=authors.get(pk),
        )
    for pk, author in (
        logs.filter(resource="notice", action="Created", actor_id__isnull=False)
        .order_by("id")
        .values_list("object_id", "actor_id")
    ):
        notices.filter(pk=pk, author__isnull=True).update(author_id=author)


def remove_legacy_feature(apps, schema_editor):
    db = schema_editor.connection.alias
    with schema_editor.connection.cursor() as cursor:
        tables = schema_editor.connection.introspection.table_names(cursor)
        for table in ("reservations_statuschange", "reservations_reservation"):
            if table in tables:
                cursor.execute("DROP TABLE " + schema_editor.quote_name(table))
    logs = apps.get_model("audit_logs", "AuditLog").objects.using(db)
    logs.filter(resource__iexact="reservation").delete()
    apps.get_model("notifications", "Notification").objects.using(db).filter(
        models.Q(link="/reservations") | models.Q(link__startswith="/reservations/")
    ).delete()
    apps.get_model("contenttypes", "ContentType").objects.using(db).filter(
        app_label="reservations"
    ).delete()
    venues = (
        apps.get_model("venues", "Venue")
        .objects.using(db)
        .filter(
            name__in=(
                "Seminar Room",
                "Media Studio",
                "Innovation Lab",
                "College Auditorium",
            )
        )
    )
    events = apps.get_model("events", "Event").objects.using(db)
    notices = apps.get_model("venues", "Notice").objects.using(db)
    for venue_id, name in list(venues.values_list("id", "name")):
        events.filter(venue_id=venue_id).update(venue_id=None, venue_snapshot=name)
        notices.filter(venue_id=venue_id).update(venue_id=None, venue_snapshot=name)
    venues.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("events", "0002_legacy_schedule"),
        ("venues", "0005_notice_publication"),
        ("audit_logs", "0004_normalize_authentication_actions"),
        ("notifications", "0002_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("admin", "0003_logentry_add_action_flag_choices"),
        ("auth", "0012_alter_user_first_name_max_length"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AddField(
            model_name="event", name="date", field=models.DateField(null=True)
        ),
        migrations.AddField(
            model_name="event", name="start", field=models.TimeField(null=True)
        ),
        migrations.AddField(
            model_name="event", name="end", field=models.TimeField(null=True)
        ),
        migrations.AddField(
            model_name="event",
            name="cancelled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="event",
            name="venue_snapshot",
            field=models.CharField(max_length=120, blank=True),
        ),
        migrations.AddField(
            model_name="event",
            name="venue",
            field=models.ForeignKey(
                "venues.venue",
                on_delete=django.db.models.deletion.PROTECT,
                null=True,
                blank=True,
                related_name="events",
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="author",
            field=models.ForeignKey(
                settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
            ),
        ),
        migrations.RunPython(copy_schedules, migrations.RunPython.noop),
        migrations.RemoveField(model_name="event", name="legacy_schedule_id"),
        migrations.AlterField(
            model_name="event", name="date", field=models.DateField()
        ),
        migrations.AlterField(
            model_name="event", name="start", field=models.TimeField()
        ),
        migrations.AlterField(model_name="event", name="end", field=models.TimeField()),
        migrations.AlterModelOptions(
            name="event", options={"ordering": ["date", "start", "pk"]}
        ),
        migrations.AddConstraint(
            model_name="event",
            constraint=models.CheckConstraint(
                condition=models.Q(end__gt=models.F("start")), name="event_time_order"
            ),
        ),
        migrations.AddConstraint(
            model_name="event",
            constraint=models.CheckConstraint(
                condition=models.Q(venue__isnull=False) | ~models.Q(venue_snapshot=""),
                name="event_keeps_venue_name",
            ),
        ),
        migrations.RunPython(remove_legacy_feature),
    ]
