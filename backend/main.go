package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

var db *sql.DB

func main() {
	var err error
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}

	r := gin.Default()

	// POST /auth/validate endpoint
	r.POST("/auth/validate", validateApiKeyHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go backend running on port %s...", port)
	r.Run(":" + port)
}

func hashApiKey(rawKey string) string {
	sum := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(sum[:])
}

func validateApiKeyHandler(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(401, gin.H{"error": "Missing or invalid Authorization header"})
		return
	}

	rawKey := strings.TrimPrefix(authHeader, "Bearer ")

	keyHash := hashApiKey(rawKey)

	// Look up the key in Neon DB and join with users table
	var userID, planTier string
	var revokedAt sql.NullTime

	query := `
		SELECT k.user_id, k.revoked_at, u.plan_tier
		FROM api_keys k
		JOIN users u ON k.user_id = u.id
		WHERE k.key_hash = $1
	`
	err := db.QueryRow(query, keyHash).Scan(&userID, &revokedAt, &planTier)

	if err == sql.ErrNoRows {
		c.JSON(401, gin.H{"error": "Invalid API key"})
		return
	} else if err != nil {
		c.JSON(500, gin.H{"error": "Database error"})
		return
	}

	// Refuse revoked keys
	if revokedAt.Valid {
		c.JSON(401, gin.H{"error": "API key has been revoked"})
		return
	}

	// Update last_used_at timestamp asynchronously or synchronously
	_, _ = db.Exec("UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1", keyHash)

	// Return user ID and plan tier
	c.JSON(200, gin.H{
		"valid":     true,
		"user_id":   userID,
		"plan_tier": planTier,
	})
}
