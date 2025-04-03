#!/bin/bash

API_URL="https://courier.spectral.gg/images/dota/icons"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install it first."
    exit 1
fi

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed. Please install it first."
    exit 1
fi

echo "Fetching list of base icon names from ${API_URL}..."
echo "(API seems to provide names without .png extension now)"

# Fetch the list (contains base names like 'abaddon_aphotic_shield')
curl -s "${API_URL}" | jq -r '.[]' | while IFS= read -r base_filename; do
    if [[ -z "$base_filename" || "$base_filename" == "null" ]]; then
        echo "Warning: Skipping invalid base filename entry."
        continue
    fi

    # --- MANUALLY ADD .png ---
    # Define the actual filename we want to save the file as
    output_filename="${base_filename}.png"
    # Construct the URL. Assumption: resource URL still ends with .png
    # Try URL like: .../spellicons/abaddon_aphotic_shield.png
    primary_image_url="${API_URL}/${output_filename}"
    # Alternative URL in case the path segment itself shouldn't have .png
    # URL like: .../spellicons/abaddon_aphotic_shield
    secondary_image_url="${API_URL}/${base_filename}"


    echo "DEBUG: Base filename read: [${base_filename}]"
    echo "DEBUG: Output filename set to: [${output_filename}]"
    echo "DEBUG: Attempting Primary URL: [${primary_image_url}]"

    echo "Downloading as ${output_filename}..."

    # Attempt download using the primary URL (with .png)
    curl -s -f -o "${output_filename}" "${primary_image_url}"
    exit_status=$? # Capture exit status

    # Check if the first attempt failed (e.g., 404 Not Found)
    if [[ $exit_status -ne 0 ]]; then
        echo "Warning: Failed to download [${output_filename}] using primary URL (${primary_image_url}). Exit status: ${exit_status}"
        echo "DEBUG: Retrying with Secondary URL: [${secondary_image_url}]"

        # Attempt download using the secondary URL (without .png)
        curl -s -f -o "${output_filename}" "${secondary_image_url}"
        exit_status=$? # Capture exit status of the retry

        if [[ $exit_status -ne 0 ]]; then
            echo "ERROR: Retry also failed for [${output_filename}] using secondary URL (${secondary_image_url}). Exit status: ${exit_status}"
            # Optional: delete potentially empty/corrupt file created by failed -o
            # rm -f "${output_filename}"
        else
            echo "DEBUG: Successfully downloaded [${output_filename}] using secondary URL."
        fi
    else
      echo "DEBUG: Successfully downloaded [${output_filename}] using primary URL."
    fi

    # Optional: Add a small delay
    # sleep 0.1
done

echo "Download complete."

exit 0