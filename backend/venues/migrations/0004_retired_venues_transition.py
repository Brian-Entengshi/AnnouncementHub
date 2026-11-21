from django.db import migrations


class Migration(migrations.Migration):
    replaces = [("venues", "0004_remove_retired_venues")]
    dependencies = [
        ("venues", "0003_notice_venue_snapshot_alter_notice_venue_and_more")
    ]
    # The cleanup now runs after events have independent venue references.
    operations = []
