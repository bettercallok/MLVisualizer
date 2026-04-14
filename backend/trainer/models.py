from django.db import models
from django.contrib.auth.models import User

class CustomDataset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    csv_file = models.FileField(upload_to='datasets/')
    feature_count = models.IntegerField(default=2)
    class_count = models.IntegerField(default=2)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.user.username})"

class Experiment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    dataset_name = models.CharField(max_length=255)
    model_type = models.CharField(max_length=100)
    accuracy = models.FloatField()
    hyperparameters = models.JSONField(default=dict)
    run_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.model_type} - {self.accuracy:.2f}"
