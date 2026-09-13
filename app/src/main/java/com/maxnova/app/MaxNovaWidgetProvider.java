package com.maxnova.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class MaxNovaWidgetProvider extends AppWidgetProvider {
    private PendingIntent action(Context c, String name, int requestCode) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("com.maxnova.app.WIDGET_" + name.toUpperCase());
        i.putExtra("nativeAction", name);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.maxnova_widget);
            views.setOnClickPendingIntent(R.id.widget_chat, action(context, "chat", id * 10 + 1));
            views.setOnClickPendingIntent(R.id.widget_media, action(context, "media", id * 10 + 2));
            views.setOnClickPendingIntent(R.id.widget_voice, action(context, "voice", id * 10 + 3));
            manager.updateAppWidget(id, views);
        }
    }
}
