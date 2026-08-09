-- Make the private runtime switch visible to service-role integration checks after migration.
notify pgrst, 'reload schema';
