from django.db import migrations, models


class Migration(migrations.Migration):
    replaces = [("events", "0002_initial")]
    dependencies = [("events", "0001_initial")]
    # Represent the existing column without loading the retired feature's app.
    operations = [
        migrations.AddField(
            model_name="event",
            name="legacy_schedule_id",
            field=models.BigIntegerField(
                db_column="reservation_id", unique=True, null=True
            ),
        ),
        migrations.AlterModelOptions(name="event", options={"ordering": ["pk"]}),
    ]
