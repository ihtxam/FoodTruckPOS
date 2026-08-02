package com.chaslay.pos.ui.demo

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R

private val DemoBannerBackground = Color(0xFFF59E0B)
private val DemoBannerButton = Color(0xFF1F2937)

@Composable
fun DemoModeBanner(
    onGoLiveClick: () -> Unit,
    isPurging: Boolean,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(DemoBannerBackground)
            .heightIn(min = 40.dp)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = stringResource(R.string.demo_mode_banner_label),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            fontSize = 13.sp,
            modifier = Modifier.weight(1f)
        )
        Button(
            onClick = onGoLiveClick,
            enabled = !isPurging,
            shape = RoundedCornerShape(8.dp),
            contentPadding = ButtonDefaults.ContentPadding,
            colors = ButtonDefaults.buttonColors(
                containerColor = DemoBannerButton,
                contentColor = Color.White
            )
        ) {
            Text(
                text = if (isPurging) {
                    stringResource(R.string.demo_go_live_working)
                } else {
                    stringResource(R.string.demo_go_live_button)
                },
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
