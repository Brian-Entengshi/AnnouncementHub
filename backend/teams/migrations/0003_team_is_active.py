from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("teams", "0002_core_teams")]
    operations = [
        migrations.AddField(
            model_name="team",
            name="is_active",
            field=models.BooleanField(default=True),
        )
    ]
