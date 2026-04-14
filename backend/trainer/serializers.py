from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CustomDataset, Experiment

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class CustomDatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomDataset
        fields = '__all__'
        read_only_fields = ('user', 'feature_count', 'class_count')

class ExperimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experiment
        fields = '__all__'
        read_only_fields = ('user',)
