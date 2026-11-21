package com.cityfix.android

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.cityfix.android.data.CityFixDatabase
import com.cityfix.android.data.DeliveryState
import com.cityfix.android.data.Incident
import com.cityfix.android.data.IncidentCategory
import com.cityfix.android.location.DeviceLocationProvider
import com.cityfix.android.mesh.BleCapability
import java.util.UUID
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val dao = CityFixDatabase.get(this).incidentDao()
        val locationProvider = DeviceLocationProvider(this)
        val bleCapability = BleCapability(this)
        setContent {
            MaterialTheme {
                CityFixHome(
                    dao = dao,
                    locationProvider = locationProvider,
                    bleCapability = bleCapability
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CityFixHome(
    dao: com.cityfix.android.data.IncidentDao,
    locationProvider: DeviceLocationProvider,
    bleCapability: BleCapability
) {
    val incidents by dao.observeAll().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var selectedCategory by remember { mutableStateOf(IncidentCategory.OTHER) }
    var description by remember { mutableStateOf("") }
    var showComposer by remember { mutableStateOf(false) }
    var locationPermissionGranted by remember { mutableStateOf(false) }
    var locationMessage by remember { mutableStateOf("Location permission not yet granted") }
    val permissions = remember {
        buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 31) {
                add(Manifest.permission.BLUETOOTH_SCAN)
                add(Manifest.permission.BLUETOOTH_ADVERTISE)
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }.toTypedArray()
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        locationPermissionGranted =
            result[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            result[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        locationMessage = if (locationPermissionGranted) {
            "Location permission granted. A location fix is requested when creating an SOS."
        } else {
            "Location unavailable: grant permission to attach coordinates."
        }
    }
    val capability = remember { bleCapability.inspect() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("CityFix")
                        Text(
                            "Disaster management",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Emergency SOS", style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(6.dp))
                        Text("Create an incident report with your device location. SOS is saved locally first.")
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = { showComposer = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Text("Create SOS")
                        }
                    }
                }
            }
            item {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Text("Device capabilities", style = MaterialTheme.typography.titleMedium)
                        Text("BLE supported: ${capability.bleSupported}")
                        Text("Bluetooth enabled: ${capability.bluetoothEnabled}")
                        Text("Peer relay: Not implemented yet")
                        Text("Network: determined separately by the operating system")
                        Spacer(Modifier.height(6.dp))
                        Text(locationMessage, style = MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick = { permissionLauncher.launch(permissions) }) {
                            Text("Grant location and nearby-device permissions")
                        }
                    }
                }
            }
            item {
                Text("Incident history", style = MaterialTheme.typography.titleLarge)
                Text("${incidents.size} locally stored incident(s)")
            }
            if (incidents.isEmpty()) {
                item { Text("No incidents recorded on this device.") }
            }
            items(incidents, key = { it.id }) { incident ->
                IncidentCard(incident)
            }
            item {
                Text(
                    "CityFix does not dispatch emergency services. For immediate danger, contact your local emergency number.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }

    if (showComposer) {
        AlertDialog(
            onDismissRequest = { showComposer = false },
            title = { Text("Create emergency SOS") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select incident type")
                    IncidentCategory.entries.forEach { category ->
                        OutlinedButton(
                            onClick = { selectedCategory = category },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                if (selectedCategory == category) "✓ ${category.label}"
                                else category.label
                            )
                        }
                    }
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it.take(500) },
                        label = { Text("What happened?") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    scope.launch {
                        val location = if (locationPermissionGranted) {
                            locationProvider.currentLocation()
                        } else null
                        val incident = Incident(
                            id = UUID.randomUUID().toString(),
                            category = selectedCategory.name,
                            description = description.trim(),
                            latitude = location?.latitude,
                            longitude = location?.longitude,
                            accuracyMeters = location?.accuracyMeters,
                            createdAtEpochMs = System.currentTimeMillis(),
                            deliveryState = DeliveryState.QUEUED.name
                        )
                        dao.insert(incident)
                        description = ""
                        showComposer = false
                    }
                }) {
                    Text("Save SOS locally")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showComposer = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun IncidentCard(incident: Incident) {
    Card {
        Column(Modifier.padding(14.dp)) {
            Text(incident.category, style = MaterialTheme.typography.titleMedium)
            Text(incident.description.ifBlank { "No description supplied" })
            Text("State: ${incident.deliveryState}")
            val location = if (incident.latitude != null && incident.longitude != null) {
                "${incident.latitude}, ${incident.longitude} (±${incident.accuracyMeters ?: 0f} m)"
            } else "Location not captured"
            Text(location, style = MaterialTheme.typography.bodySmall)
        }
    }
}
