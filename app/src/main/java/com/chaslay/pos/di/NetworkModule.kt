package com.chaslay.pos.di

import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.remote.FloorApi
import com.chaslay.pos.data.remote.LicenseApi
import com.chaslay.pos.data.remote.PosAuthApi
import com.chaslay.pos.data.remote.SyncApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val apiKeyInterceptor = Interceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
            if (BuildConfig.SYNC_API_KEY.isNotBlank()) {
                requestBuilder.header("X-Api-Key", BuildConfig.SYNC_API_KEY)
            }
            chain.proceed(requestBuilder.build())
        }
        return OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(apiKeyInterceptor)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.LICENSE_API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides
    @Singleton
    fun provideLicenseApi(retrofit: Retrofit): LicenseApi = retrofit.create(LicenseApi::class.java)

    @Provides
    @Singleton
    fun providePosAuthApi(retrofit: Retrofit): PosAuthApi = retrofit.create(PosAuthApi::class.java)

    @Provides
    @Singleton
    fun provideSyncApi(retrofit: Retrofit): SyncApi = retrofit.create(SyncApi::class.java)

    @Provides
    @Singleton
    fun provideFloorApi(retrofit: Retrofit): FloorApi = retrofit.create(FloorApi::class.java)

    @Provides
    @Singleton
    fun provideReceiptApi(retrofit: Retrofit): com.chaslay.pos.data.remote.ReceiptApi =
        retrofit.create(com.chaslay.pos.data.remote.ReceiptApi::class.java)
}
