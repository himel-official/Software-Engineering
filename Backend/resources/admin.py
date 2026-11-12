from django.contrib import admin

from resources.models import EmergencyContact, SafetyGuideline, SystemSetting

admin.site.register(EmergencyContact)
admin.site.register(SafetyGuideline)
admin.site.register(SystemSetting)
