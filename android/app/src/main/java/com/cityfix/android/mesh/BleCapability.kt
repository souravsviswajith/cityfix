package com.cityfix.android.mesh

import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager

data class MeshCapability(
    val bleSupported: Boolean,
    val bluetoothEnabled: Boolean
)

class BleCapability(private val context: Context) {
    fun inspect(): MeshCapability {
        val supported = context.packageManager.hasSystemFeature(
            PackageManager.FEATURE_BLUETOOTH_LE
        )
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        val enabled = runCatching { manager.adapter?.isEnabled == true }.getOrDefault(false)
        return MeshCapability(supported, enabled)
    }
}
